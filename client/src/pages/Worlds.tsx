import { useEffect,useRef,useState } from "react";
import { useLocation } from "wouter";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { ArrowLeft, ArrowRight, Compass, LockKeyhole, Rotate3D } from "lucide-react";
import WorldLoadingOverlay from "@/components/WorldLoadingOverlay";

type WorldId="club"|"theater"|"neighborhood"|"laser"|"board"|"space"|"beach"|"racetrack";
const WORLDS:{id:WorldId;title:string;description:string;path?:string;color:number}[]=[
  {id:"club",title:"A.R.I.S.E Arcade",description:"Dance, meet readers, and play arcade games together.",path:"/arise-arcade",color:0xc026d3},
  {id:"theater",title:"A.R.I.S.E. Cinema",description:"Sit with friends, grab popcorn, and watch the always-on Club movie channel.",path:"/club-arise/theater",color:0xf59e0b},
  {id:"neighborhood",title:"The Block",description:"Walk your neighborhood, find your house, and see other readers.",path:"/neighborhood",color:0x4ade80},
  {id:"board",title:"A.R.I.S.E. Board Quest",description:"Roll the dice, move through the 3D board, and take on reading challenges.",path:"/board-game-world",color:0xfbbf24},
  {id:"laser",title:"Laser Royale",description:"The laser tag arena is closed for now. Coming soon!",color:0x6b7280},
  {id:"space",title:"Outer Space",description:"A glowing galaxy of planets and places to explore. Coming soon.",color:0x9868f4},
  {id:"beach",title:"The Beach",description:"Palm trees, a seaside boardwalk, and sunny adventures. Coming soon.",color:0xfacc6b},
  {id:"racetrack",title:"The Racetrack",description:"Fast lanes and a place to put your cars to the test. Coming soon.",color:0xf87171},
];

function sphere(radius:number,color:number,roughness=.8){return new THREE.Mesh(new THREE.SphereGeometry(radius,32,24),new THREE.MeshStandardMaterial({color,roughness,metalness:.1}));}
function marker(text:string){
  const canvas=document.createElement("canvas");canvas.width=512;canvas.height=128;const ctx=canvas.getContext("2d")!;
  ctx.fillStyle="rgba(7,15,35,.91)";ctx.beginPath();ctx.roundRect(8,10,496,106,30);ctx.fill();ctx.strokeStyle="#67e8f9";ctx.lineWidth=4;ctx.stroke();
  ctx.fillStyle="white";ctx.font="bold 39px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(text,256,64);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false}));sprite.scale.set(3.7,.95,1);return sprite;
}
function makeWorld(id:WorldId,color:number){
  const group=new THREE.Group();group.userData.worldId=id;
  const surface=sphere(1.25,id==="club"?0x251b51:id==="theater"?0x2a1621:id==="neighborhood"?0x65af7a:id==="laser"?0x102d3b:id==="board"?0x5b3a13:id==="space"?0x27205d:id==="beach"?0x43b9cb:0x34775d);group.add(surface);
  const band=new THREE.Mesh(new THREE.TorusGeometry(1.4,.045,10,64),new THREE.MeshBasicMaterial({color}));band.rotation.x=Math.PI/2.5;group.add(band);
  if(id==="club"){
    const base=new THREE.Mesh(new THREE.CylinderGeometry(.65,.8,.28,12),new THREE.MeshStandardMaterial({color:0x191936,emissive:color,emissiveIntensity:.25}));base.position.y=1.16;group.add(base);
    for(const x of [-.4,0,.4]){const tower=new THREE.Mesh(new THREE.BoxGeometry(.3,.65,.3),new THREE.MeshStandardMaterial({color:x===0?0x22d3ee:color,emissive:x===0?0x22d3ee:color,emissiveIntensity:.8}));tower.position.set(x,1.5,0);group.add(tower);}
    const ball=sphere(.2,0xffffff,.15);ball.position.set(0,2.1,0);group.add(ball);
  }else if(id==="theater"){
    const building=new THREE.Mesh(new THREE.BoxGeometry(1.35,.85,.95),new THREE.MeshStandardMaterial({color:0x241321,emissive:0x7c2d12,emissiveIntensity:.25,roughness:.45}));building.position.set(0,1.45,0);group.add(building);
    const marquee=new THREE.Mesh(new THREE.BoxGeometry(1.55,.28,.18),new THREE.MeshStandardMaterial({color:0xf59e0b,emissive:0xf59e0b,emissiveIntensity:1.2}));marquee.position.set(0,1.88,.5);group.add(marquee);
    const screen=new THREE.Mesh(new THREE.PlaneGeometry(.92,.5),new THREE.MeshBasicMaterial({color:0xe0f2fe}));screen.position.set(0,1.48,.49);group.add(screen);
    for(const x of [-.48,0,.48]){const light=sphere(.08,0xfef3c7,.15);light.position.set(x,2.12,.05);group.add(light);}
    const popcorn=new THREE.Mesh(new THREE.CylinderGeometry(.18,.14,.34,12),new THREE.MeshStandardMaterial({color:0xef4444,roughness:.6}));popcorn.position.set(.72,1.34,.55);group.add(popcorn);
    for(let i=0;i<5;i++){const kernel=sphere(.07,0xfef3c7,.5);kernel.position.set(.62+(i%3)*.08,1.56+Math.floor(i/3)*.06,.54);group.add(kernel);}
  }else if(id==="neighborhood"){
    for(const x of [-.55,.45]){const house=new THREE.Mesh(new THREE.BoxGeometry(.65,.6,.55),new THREE.MeshStandardMaterial({color:x<0?0xffcf9a:0xcce4fb}));house.position.set(x,1.26,0);group.add(house);const roof=new THREE.Mesh(new THREE.ConeGeometry(.52,.36,4),new THREE.MeshStandardMaterial({color:x<0?0xbe4859:0x208d7c}));roof.position.set(x,1.76,0);roof.rotation.y=Math.PI/4;group.add(roof);}
  }else if(id==="laser"){
    const arena=new THREE.Mesh(new THREE.CylinderGeometry(.92,.92,.18,32),new THREE.MeshStandardMaterial({color:0x111827,emissive:0x0e7490,emissiveIntensity:.65,metalness:.35}));arena.position.y=1.18;group.add(arena);
    const ring2=new THREE.Mesh(new THREE.TorusGeometry(.78,.05,8,48),new THREE.MeshBasicMaterial({color:0x22d3ee}));ring2.rotation.x=Math.PI/2;ring2.position.y=1.3;group.add(ring2);
    for(let i=0;i<4;i++){const tower=new THREE.Mesh(new THREE.BoxGeometry(.18,.65,.18),new THREE.MeshStandardMaterial({color:i%2?0x22d3ee:0xf472b6,emissive:i%2?0x22d3ee:0xf472b6,emissiveIntensity:1.1}));const a=i*Math.PI/2;tower.position.set(Math.cos(a)*.62,1.58,Math.sin(a)*.62);group.add(tower);}
    const beam=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,1.5,8),new THREE.MeshBasicMaterial({color:0x67e8f9}));beam.rotation.z=Math.PI/2;beam.position.set(0,1.65,.15);group.add(beam);
    const shield=new THREE.Mesh(new THREE.OctahedronGeometry(.22,0),new THREE.MeshStandardMaterial({color:0x60a5fa,emissive:0x60a5fa,emissiveIntensity:1.4}));shield.position.set(0,2.05,0);group.add(shield);
  }else if(id==="board"){
    const board=new THREE.Mesh(new THREE.BoxGeometry(1.45,.16,1.1),new THREE.MeshStandardMaterial({color:0xf8fafc,roughness:.55}));board.position.y=1.22;group.add(board);
    const tileColors=[0xef4444,0x3b82f6,0x22c55e,0xfacc15];
    for(let i=0;i<8;i++){const tile=new THREE.Mesh(new THREE.BoxGeometry(.28,.08,.28),new THREE.MeshStandardMaterial({color:tileColors[i%4]}));const a=i*Math.PI/4;tile.position.set(Math.cos(a)*.52,1.35,Math.sin(a)*.36);group.add(tile);}
    const die=new THREE.Mesh(new THREE.BoxGeometry(.34,.34,.34),new THREE.MeshStandardMaterial({color:0xffffff,roughness:.3}));die.position.set(0,1.7,0);die.rotation.set(.4,.6,.2);group.add(die);
  }else if(id==="space"){
    const moon=sphere(.46,0xffdcab);moon.position.set(.8,1.6,0);group.add(moon);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.6,.045,8,48),new THREE.MeshBasicMaterial({color:0xe9b8ff}));ring.position.copy(moon.position);ring.rotation.x=.5;group.add(ring);
    for(let i=0;i<6;i++){const star=sphere(.07,0xffffff);star.position.set(Math.sin(i*2.4)*1.6,Math.cos(i*3)*1.6,Math.cos(i*2.4)*.9);group.add(star);}
  }else if(id==="beach"){
    const sand=new THREE.Mesh(new THREE.CylinderGeometry(.9,.85,.13,24),new THREE.MeshStandardMaterial({color:0xfbd892}));sand.position.y=1.2;group.add(sand);
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.055,.095,1.2,8),new THREE.MeshStandardMaterial({color:0x795235}));trunk.position.set(-.25,1.8,0);trunk.rotation.z=-.2;group.add(trunk);
    for(let i=0;i<6;i++){const leaf=new THREE.Mesh(new THREE.ConeGeometry(.19,.75,5),new THREE.MeshStandardMaterial({color:0x258c58}));leaf.position.set(-.38+Math.cos(i*Math.PI/3)*.38,2.45,Math.sin(i*Math.PI/3)*.38);leaf.rotation.z=Math.PI/2-i*.4;group.add(leaf);}
  }else{
    const track=new THREE.Mesh(new THREE.TorusGeometry(.82,.19,12,48),new THREE.MeshStandardMaterial({color:0x202637}));track.position.y=1.24;track.rotation.x=Math.PI/2;group.add(track);
    const car=new THREE.Mesh(new THREE.BoxGeometry(.5,.22,.3),new THREE.MeshStandardMaterial({color:0xff5563,emissive:0x8b172b,emissiveIntensity:.4}));car.position.set(.55,1.45,.55);group.add(car);
  }
  if(id==="laser")group.traverse(object=>{const mesh=object as THREE.Mesh;if(mesh.material&&!Array.isArray(mesh.material)){const material=mesh.material as THREE.MeshStandardMaterial;material.color?.set(0x6b7280);material.emissive?.set(0x252a32);if('emissiveIntensity' in material)material.emissiveIntensity=.15;}});
  const label=marker(WORLDS.find(world=>world.id===id)!.title);label.position.y=2.65;group.add(label);
  if(id==="laser"){const soon=marker("COMING SOON");soon.position.y=3.55;soon.scale.set(3.2,.8,1);group.add(soon);}
  return group;
}

export default function Worlds(){
  const [,navigate]=useLocation();const mountRef=useRef<HTMLDivElement>(null);
  const [selected,setSelected]=useState<WorldId>("neighborhood");
  const [travel,setTravel]=useState<{path:string;label:string}|null>(null);
  const world=WORLDS.find(item=>item.id===selected)!;
  useEffect(()=>{
    if(!travel)return;
    const timer=window.setTimeout(()=>navigate(travel.path),800);
    return()=>window.clearTimeout(timer);
  },[travel,navigate]);
  useEffect(()=>{
    const mount=mountRef.current;if(!mount)return;
    const scene=new THREE.Scene();scene.background=new THREE.Color(0x070b1b);
    const camera=new THREE.PerspectiveCamera(48,1,.1,100);camera.position.set(0,7,19);
    const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance"});renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.outputColorSpace=THREE.SRGBColorSpace;mount.appendChild(renderer.domElement);
    const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,0,0);controls.enableDamping=true;controls.enablePan=false;controls.minDistance=11;controls.maxDistance=42;controls.minPolarAngle=.35;controls.maxPolarAngle=Math.PI-.35;
    scene.add(new THREE.HemisphereLight(0xffffff,0x233766,2.5));const sun=new THREE.DirectionalLight(0xffffff,3.2);sun.position.set(-8,12,12);scene.add(sun);
    const galaxy=new THREE.Group();scene.add(galaxy);
    const earth=sphere(3.15,0x176a9d,.66);galaxy.add(earth);
    const landMaterial=new THREE.MeshStandardMaterial({color:0x55bb77,roughness:.9});
    for(let i=0;i<45;i++){
      const latitude=Math.asin(Math.sin(i*2.39996)*.78),longitude=i*2.41;
      const patch=new THREE.Mesh(new THREE.IcosahedronGeometry(.32+(i%5)*.08,0),landMaterial);
      patch.position.set(Math.cos(latitude)*Math.cos(longitude)*3.08,Math.sin(latitude)*3.08,Math.cos(latitude)*Math.sin(longitude)*3.08);
      patch.scale.set(1.4,.6,1);galaxy.add(patch);
    }
    const atmosphere=new THREE.Mesh(new THREE.SphereGeometry(3.4,40,32),new THREE.MeshBasicMaterial({color:0x55baff,transparent:true,opacity:.11,depthWrite:false}));galaxy.add(atmosphere);
    const halo=new THREE.Mesh(new THREE.TorusGeometry(5.55,.025,8,128),new THREE.MeshBasicMaterial({color:0x57bce9,transparent:true,opacity:.6}));halo.rotation.x=Math.PI/2.7;galaxy.add(halo);
    const orbit=new THREE.Group();galaxy.add(orbit);
    const worlds:THREE.Group[]=[];
    WORLDS.forEach((item,i)=>{const angle=i*2*Math.PI/WORLDS.length-.55;const planet=makeWorld(item.id,item.color);planet.position.set(Math.sin(angle)*6.7,(i%2?-.8:.9),Math.cos(angle)*6.7);orbit.add(planet);worlds.push(planet);});
    const stars=new THREE.BufferGeometry();const positions=new Float32Array(600*3);for(let i=0;i<600;i++){positions[i*3]=(Math.random()-.5)*85;positions[i*3+1]=(Math.random()-.5)*65;positions[i*3+2]=(Math.random()-.5)*85;}stars.setAttribute("position",new THREE.BufferAttribute(positions,3));scene.add(new THREE.Points(stars,new THREE.PointsMaterial({color:0xc4dafa,size:.09,sizeAttenuation:true})));
    const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();let down:{x:number;y:number}|null=null;
    const pointerDown=(e:PointerEvent)=>{down={x:e.clientX,y:e.clientY};};
    const pointerUp=(e:PointerEvent)=>{if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>8){down=null;return;}down=null;const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);
      for(const hit of ray.intersectObjects(worlds,true)){let node:THREE.Object3D|null=hit.object;while(node){if(node.userData.worldId){setSelected(node.userData.worldId as WorldId);return;}node=node.parent;}}
    };
    renderer.domElement.addEventListener("pointerdown",pointerDown);renderer.domElement.addEventListener("pointerup",pointerUp);
    const resize=()=>{const width=mount.clientWidth,height=mount.clientHeight;camera.aspect=width/Math.max(height,1);if(width<640){camera.position.set(0,13,36);}else{camera.position.set(0,7,19);}camera.updateProjectionMatrix();renderer.setSize(width,height);controls.update();};resize();window.addEventListener("resize",resize);
    let raf=0;const clock=new THREE.Clock();const animate=()=>{const dt=Math.min(clock.getDelta(),.05);earth.rotation.y+=dt*.075;atmosphere.rotation.y-=dt*.035;orbit.rotation.y+=dt*.035;worlds.forEach(planet=>planet.rotation.y+=dt*.09);controls.update();renderer.render(scene,camera);raf=requestAnimationFrame(animate);};animate();
    return()=>{cancelAnimationFrame(raf);window.removeEventListener("resize",resize);renderer.domElement.removeEventListener("pointerdown",pointerDown);renderer.domElement.removeEventListener("pointerup",pointerUp);controls.dispose();scene.traverse(object=>{const mesh=object as THREE.Mesh;if(mesh.geometry)mesh.geometry.dispose();if(mesh.material){const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];materials.forEach(material=>{if("map" in material&&(material as THREE.SpriteMaterial).map)(material as THREE.SpriteMaterial).map?.dispose();material.dispose();});}});renderer.dispose();mount.removeChild(renderer.domElement);};
  },[]);
  return <main className="club-world-root relative h-[100dvh] overflow-hidden bg-[#070b1b] text-white">
    <div ref={mountRef} className="absolute inset-0 touch-none" aria-hidden="true"/>
    <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start gap-3 bg-gradient-to-b from-slate-950/90 to-transparent p-3 sm:p-5">
      <button type="button" onClick={()=>setTravel({path:"/library",label:"Returning to the library…"})} className="pointer-events-auto flex min-h-12 items-center gap-2 rounded-2xl bg-slate-950/80 px-4 font-black"><ArrowLeft className="h-5 w-5"/> Library</button>
      <div className="ml-auto text-right"><p className="text-sm font-black uppercase tracking-[.15em] text-cyan-300">Club Arise</p><h1 className="text-xl font-black sm:text-3xl">Choose a world</h1><p className="hidden text-sm font-bold text-white/70 sm:block"><Rotate3D className="mr-1 inline h-4 w-4"/>Drag to spin · scroll or pinch to zoom · tap a world</p></div>
    </header>
    <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-[#070b1b] via-[#070b1b]/90 to-transparent px-3 pb-3 pt-16 sm:px-6 sm:pb-6">
      <div className="pointer-events-auto mx-auto max-w-3xl rounded-[1.5rem] border border-cyan-300/25 bg-slate-950/85 p-3 shadow-2xl backdrop-blur-xl sm:p-5">
        <div className="flex items-start gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-cyan-300/15"><Compass className="text-cyan-300"/></div><div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-widest text-cyan-300">{world.path?"Open world":"Coming soon · preview"}</p><h2 className="text-xl font-black sm:text-2xl">{world.title}</h2><p className="text-xs font-medium text-white/70 sm:text-sm">{world.description}</p></div></div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Worlds">{WORLDS.map(item=><button key={item.id} type="button" onClick={()=>setSelected(item.id)} aria-pressed={selected===item.id} className={"min-h-11 shrink-0 rounded-xl border px-3 text-xs font-black sm:text-sm "+(selected===item.id?"border-cyan-300 bg-cyan-300 text-slate-950":"border-white/20 bg-white/10 text-white hover:bg-white/20")}>{item.title}{!item.path&&" · Soon"}</button>)}</div>
        {world.path?<button type="button" onClick={()=>setTravel({path:world.path!,label:`Entering ${world.title}…`})} className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-300 font-black text-slate-950">Enter {world.title}<ArrowRight className="h-5 w-5"/></button>:<div className="mt-2 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white/10 text-sm font-bold text-white/70"><LockKeyhole className="h-4 w-4"/> Preview only · coming soon</div>}
      </div>
    </div>
    {travel&&<WorldLoadingOverlay tone="universe" label={travel.label} />}
  </main>;
}
