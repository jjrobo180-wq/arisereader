import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { ArrowLeft, Crosshair, Gamepad2, Loader2, LogOut, Play, RotateCcw, Shield, Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { useLocation } from "wouter";

type Team="cyan"|"magenta";
type Player={id:number;name:string;team:Team;x:number;z:number;rot:number;moving:boolean;sprinting:boolean;tags:number;downs:number;respawnAt:number;bot:boolean};
type Room={code:string;hostId:number;phase:"lobby"|"playing"|"finished";players:Player[];scores:Record<Team,number>;serverNow:number;timeLeft:number;winner:Team|null};
type Lobby={code:string;hostName:string;players:number};
type MobileInput={forward:boolean;back:boolean;left:boolean;right:boolean;sprint:boolean};

function makeCharacter(team:Team,name:string){
 const root=new THREE.Group();
 const color=team==="cyan"?0x06b6d4:0xec4899;
 const accent=team==="cyan"?0x67e8f9:0xf9a8d4;
 const jersey=new THREE.MeshStandardMaterial({color,roughness:.48,metalness:.1});
 const jerseyDark=new THREE.MeshStandardMaterial({color:team==="cyan"?0x075985:0x9d174d,roughness:.5,metalness:.12});
 const pants=new THREE.MeshStandardMaterial({color:0x18202e,roughness:.68,metalness:.12});
 const armor=new THREE.MeshStandardMaterial({color:0x0d1420,roughness:.36,metalness:.48});
 const bootMat=new THREE.MeshStandardMaterial({color:0x080b10,roughness:.52,metalness:.2});
 const skin=new THREE.MeshStandardMaterial({color:0x9a674b,roughness:.9});
 const glass=new THREE.MeshStandardMaterial({color:0x07111d,roughness:.12,metalness:.7,emissive:accent,emissiveIntensity:.15});
 const white=new THREE.MeshStandardMaterial({color:0xf8fafc,roughness:.38,metalness:.08});
 const addShadow=(m:THREE.Mesh)=>{m.castShadow=true;m.receiveShadow=true;return m};

 const pelvis=addShadow(new THREE.Mesh(new THREE.BoxGeometry(.62,.36,.42),pants));pelvis.position.y=1.03;root.add(pelvis);
 const torso=addShadow(new THREE.Mesh(new THREE.BoxGeometry(.88,1.02,.5),jersey));torso.position.y=1.65;torso.scale.set(1,.98,1);root.add(torso);
 const chest=addShadow(new THREE.Mesh(new THREE.BoxGeometry(.74,.26,.1),jerseyDark));chest.position.set(0,1.88,.31);root.add(chest);
 const vest=addShadow(new THREE.Mesh(new THREE.BoxGeometry(.58,.54,.12),armor));vest.position.set(0,1.58,.33);root.add(vest);
 const belt=addShadow(new THREE.Mesh(new THREE.BoxGeometry(.7,.12,.5),armor));belt.position.y=1.15;root.add(belt);

 const neck=new THREE.Mesh(new THREE.CylinderGeometry(.16,.18,.18,12),skin);neck.position.y=2.27;root.add(neck);
 const head=addShadow(new THREE.Mesh(new THREE.SphereGeometry(.32,22,16),skin));head.position.y=2.55;root.add(head);
 const helmet=addShadow(new THREE.Mesh(new THREE.SphereGeometry(.39,24,16,0,Math.PI*2,0,Math.PI*.72),armor));helmet.position.set(0,2.62,0);root.add(helmet);
 const visor=addShadow(new THREE.Mesh(new THREE.BoxGeometry(.58,.2,.08),glass));visor.position.set(0,2.56,.33);root.add(visor);
 const mask=addShadow(new THREE.Mesh(new THREE.BoxGeometry(.5,.28,.12),armor));mask.position.set(0,2.37,.34);root.add(mask);
 for(const x of [-.19,.19]){const vent=new THREE.Mesh(new THREE.BoxGeometry(.06,.1,.03),new THREE.MeshBasicMaterial({color:accent}));vent.position.set(x,2.36,.41);root.add(vent);}
 const helmetStripe=new THREE.Mesh(new THREE.BoxGeometry(.08,.4,.06),new THREE.MeshStandardMaterial({color:accent,emissive:accent,emissiveIntensity:.3}));helmetStripe.position.set(0,2.81,.3);helmetStripe.rotation.x=-.35;root.add(helmetStripe);

 const armL=new THREE.Group(),armR=new THREE.Group(),legL=new THREE.Group(),legR=new THREE.Group();
 const buildArm=(group:THREE.Group,x:number)=>{
   group.position.set(x,2.02,0);
   const shoulder=addShadow(new THREE.Mesh(new THREE.SphereGeometry(.18,14,10),jerseyDark));group.add(shoulder);
   const upper=addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(.11,.42,5,10),jersey));upper.position.y=-.28;group.add(upper);
   const elbow=new THREE.Mesh(new THREE.SphereGeometry(.12,12,8),armor);elbow.position.y=-.55;group.add(elbow);
   const fore=addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(.1,.38,5,10),armor));fore.position.y=-.78;group.add(fore);
   const glove=new THREE.Mesh(new THREE.SphereGeometry(.12,12,9),armor);glove.position.y=-1.05;group.add(glove);
 };
 buildArm(armL,-.55);buildArm(armR,.55);root.add(armL,armR);

 const buildLeg=(group:THREE.Group,x:number)=>{
   group.position.set(x,1.02,0);
   const thigh=addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(.16,.48,5,10),pants));thigh.position.y=-.3;group.add(thigh);
   const knee=new THREE.Mesh(new THREE.SphereGeometry(.15,12,9),armor);knee.position.y=-.6;group.add(knee);
   const shin=addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(.14,.42,5,10),pants));shin.position.y=-.9;group.add(shin);
   const boot=addShadow(new THREE.Mesh(new THREE.BoxGeometry(.3,.2,.48),bootMat));boot.position.set(0,-1.18,.1);group.add(boot);
 };
 buildLeg(legL,-.23);buildLeg(legR,.23);root.add(legL,legR);

 const marker=new THREE.Group();marker.position.set(.27,1.78,.46);marker.rotation.x=-.08;
 const markerBody=addShadow(new THREE.Mesh(new THREE.BoxGeometry(.18,.2,.72),armor));markerBody.position.z=.28;marker.add(markerBody);
 const barrel=addShadow(new THREE.Mesh(new THREE.CylinderGeometry(.055,.06,.78,14),armor));barrel.rotation.x=Math.PI/2;barrel.position.z=.9;marker.add(barrel);
 const tip=new THREE.Mesh(new THREE.CylinderGeometry(.075,.075,.14,12),jerseyDark);tip.rotation.x=Math.PI/2;tip.position.z=1.33;marker.add(tip);
 const hopper=addShadow(new THREE.Mesh(new THREE.SphereGeometry(.22,16,10),jersey));hopper.scale.set(1,.8,1);hopper.position.set(0,.26,.18);marker.add(hopper);
 const tank=addShadow(new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,.5,12),white));tank.rotation.x=Math.PI/2;tank.position.set(0,-.02,-.32);marker.add(tank);root.add(marker);

 const pack=addShadow(new THREE.Mesh(new THREE.BoxGeometry(.7,.5,.24),armor));pack.position.set(0,1.55,-.36);root.add(pack);
 for(const x of [-.23,0,.23]){const pod=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,.42,9),jerseyDark);pod.position.set(x,1.5,-.52);root.add(pod);}

 const contact=new THREE.Mesh(new THREE.CircleGeometry(.52,24),new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.24,depthWrite:false}));contact.rotation.x=-Math.PI/2;contact.position.y=.015;root.add(contact);

 const tagCanvas=document.createElement("canvas");tagCanvas.width=640;tagCanvas.height=128;const ctx=tagCanvas.getContext("2d")!;
 ctx.fillStyle="rgba(4,10,20,.88)";ctx.beginPath();ctx.roundRect(8,8,624,112,32);ctx.fill();ctx.strokeStyle=team==="cyan"?"#67e8f9":"#f9a8d4";ctx.lineWidth=6;ctx.stroke();ctx.fillStyle="#fff";ctx.font="800 42px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(name.slice(0,20),320,64);
 const tex=new THREE.CanvasTexture(tagCanvas);tex.colorSpace=THREE.SRGBColorSpace;const label=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false}));label.scale.set(2.6,.52,1);label.position.y=3.35;root.add(label);

 root.scale.setScalar(.92);
 root.userData={armL,armR,legL,legR,torso,pelvis,marker,step:0,baseY:0};
 return root;
}

function PaintballScene({room,myId,onMove,onShoot,mobile}:{room:Room;myId:number;onMove:(x:number,z:number,rot:number,moving:boolean,sprinting:boolean)=>void;onShoot:(rot:number)=>void;mobile:MobileInput}){
 const host=useRef<HTMLDivElement>(null);
 const roomRef=useRef(room);roomRef.current=room;
 const mobileRef=useRef(mobile);mobileRef.current=mobile;
 const shootRef=useRef(onShoot);shootRef.current=onShoot;
 const moveRef=useRef(onMove);moveRef.current=onMove;
 useEffect(()=>{
  const mount=host.current;if(!mount)return;
  let renderer:THREE.WebGLRenderer|undefined,raf=0,lastSend=0;
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(58,1,.06,220);

  try{renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance",failIfMajorPerformanceCaveat:false});}catch{return;}
  const phone=matchMedia("(max-width: 820px)").matches;
  renderer.setPixelRatio(Math.min(devicePixelRatio,phone?1.2:1.8));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.14;
  renderer.shadowMap.enabled=!phone;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  mount.replaceChildren(renderer.domElement);

  scene.background=new THREE.Color(0x8ed8ff);
  scene.fog=new THREE.Fog(0xa9d9e8,55,150);
  scene.add(new THREE.HemisphereLight(0xeaf9ff,0x2c3c2b,2.15));
  const sun=new THREE.DirectionalLight(0xfff3d8,4.7);sun.position.set(-22,36,18);sun.castShadow=!phone;
  if(sun.castShadow){sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-42;sun.shadow.camera.right=42;sun.shadow.camera.top=42;sun.shadow.camera.bottom=-42;sun.shadow.camera.near=1;sun.shadow.camera.far=90;sun.shadow.bias=-.0005;}
  scene.add(sun);
  const fill=new THREE.DirectionalLight(0x8fd7ff,1.15);fill.position.set(26,12,-20);scene.add(fill);

  const makeTurf=()=>{
    const c=document.createElement("canvas");c.width=512;c.height=512;const ctx=c.getContext("2d")!;
    ctx.fillStyle="#5c9f61";ctx.fillRect(0,0,512,512);
    for(let i=0;i<9000;i++){const g=80+Math.floor(Math.random()*55);ctx.fillStyle="rgba(20,"+g+",38,"+(.05+Math.random()*.1)+")";ctx.fillRect(Math.random()*512,Math.random()*512,1+Math.random()*2,1+Math.random()*4);}
    for(let y=0;y<512;y+=64){ctx.fillStyle="rgba(255,255,255,.018)";ctx.fillRect(0,y,512,32);}
    const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(9,9);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,renderer?.capabilities.getMaxAnisotropy()||1);return t;
  };
  const groundMat=new THREE.MeshStandardMaterial({map:makeTurf(),color:0xffffff,roughness:.92,metalness:0});
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(76,76,1,1),groundMat);ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);

  const stripeMat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.45});
  for(const x of [-27,0,27]){const stripe=new THREE.Mesh(new THREE.PlaneGeometry(.14,58),stripeMat);stripe.rotation.x=-Math.PI/2;stripe.position.set(x,.02,0);scene.add(stripe);}
  for(const z of [-27,27]){const stripe=new THREE.Mesh(new THREE.PlaneGeometry(58,.14),stripeMat);stripe.rotation.x=-Math.PI/2;stripe.position.set(0,.02,z);scene.add(stripe);}

  const arena=new THREE.Group();scene.add(arena);
  const soft=(color:number)=>new THREE.MeshStandardMaterial({color,roughness:.4,metalness:.04});
  const cyanMat=soft(0x0891b2),pinkMat=soft(0xdb2777),darkMat=soft(0x263244),yellowMat=soft(0xf4b942),whiteMat=soft(0xe8f2f4);
  const inflatable=(x:number,z:number,shape:"can"|"wedge"|"brick"|"dorito",team:"cyan"|"pink"|"neutral",rot=0,scale=1)=>{
    const mat=team==="cyan"?cyanMat:team==="pink"?pinkMat:darkMat;const g=new THREE.Group();
    let body:THREE.Mesh;
    if(shape==="can"){body=new THREE.Mesh(new THREE.CapsuleGeometry(1.05*scale,2.5*scale,8,18),mat);body.position.y=2.3*scale;}
    else if(shape==="brick"){body=new THREE.Mesh(new THREE.BoxGeometry(4.6*scale,2.1*scale,1.5*scale,4,2,2),mat);body.position.y=1.05*scale;}
    else if(shape==="wedge"){body=new THREE.Mesh(new THREE.CylinderGeometry(.35*scale,1.55*scale,3.8*scale,18),mat);body.rotation.z=Math.PI/2;body.position.y=1.35*scale;}
    else {body=new THREE.Mesh(new THREE.ConeGeometry(1.7*scale,4.6*scale,4),mat);body.rotation.y=Math.PI/4;body.position.y=2.3*scale;}
    body.castShadow=!phone;body.receiveShadow=true;g.add(body);
    const band=new THREE.Mesh(new THREE.TorusGeometry(shape==="can"?1.03*scale:1.15*scale,.07*scale,8,30),whiteMat);band.rotation.x=Math.PI/2;band.position.y=shape==="can"?2.3*scale:1.2*scale;if(shape!=="can")band.visible=false;g.add(band);
    g.position.set(x,0,z);g.rotation.y=rot;arena.add(g);return g;
  };
  inflatable(-20,-12,"can","cyan",0,1.1);inflatable(-20,12,"can","cyan",0,1.1);
  inflatable(20,-12,"can","pink",0,1.1);inflatable(20,12,"can","pink",0,1.1);
  inflatable(-11,-8,"wedge","cyan",-.28,1);inflatable(-11,9,"brick","cyan",.22,.95);
  inflatable(11,8,"wedge","pink",.28,1);inflatable(11,-9,"brick","pink",-.22,.95);
  inflatable(-4,-14,"dorito","neutral",.25,.8);inflatable(5,14,"dorito","neutral",-.25,.8);
  inflatable(0,0,"brick","neutral",.1,1.1);inflatable(-2,7,"can","neutral",0,.75);inflatable(3,-7,"can","neutral",0,.75);

  const wallMat=new THREE.MeshStandardMaterial({color:0x1c2a38,roughness:.62,metalness:.18});
  for(const x of [-31,31]){const wall=new THREE.Mesh(new THREE.BoxGeometry(1,4.6,64),wallMat);wall.position.set(x,2.3,0);wall.castShadow=!phone;arena.add(wall);}
  for(const z of [-31,31]){const wall=new THREE.Mesh(new THREE.BoxGeometry(64,4.6,1),wallMat);wall.position.set(0,2.3,z);wall.castShadow=!phone;arena.add(wall);}

  const makeNetTexture=()=>{
    const c=document.createElement("canvas");c.width=256;c.height=256;const ctx=c.getContext("2d")!;ctx.clearRect(0,0,256,256);ctx.strokeStyle="rgba(200,240,245,.42)";ctx.lineWidth=1;
    for(let i=0;i<=256;i+=16){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,256);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(256,i);ctx.stroke();}
    const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(5,1);return t;
  };
  const netMat=new THREE.MeshBasicMaterial({map:makeNetTexture(),transparent:true,opacity:.28,side:THREE.DoubleSide,depthWrite:false});
  for(const [x,z,ry] of [[-32,0,Math.PI/2],[32,0,Math.PI/2],[0,-32,0],[0,32,0]] as [number,number,number][]){const net=new THREE.Mesh(new THREE.PlaneGeometry(64,10),netMat);net.position.set(x,6,z);net.rotation.y=ry;arena.add(net);}

  const stand=(z:number,flip=false)=>{
    const g=new THREE.Group();
    for(let row=0;row<4;row++){const seat=new THREE.Mesh(new THREE.BoxGeometry(24,.5,2.2),new THREE.MeshStandardMaterial({color:row%2?0x24364a:0x31475d,roughness:.65,metalness:.15}));seat.position.set(0,row*.9,row*(flip?-1:1)*1.25);g.add(seat);}
    const roof=new THREE.Mesh(new THREE.BoxGeometry(25,.35,6),new THREE.MeshStandardMaterial({color:0x142334,roughness:.45,metalness:.32}));roof.position.set(0,5.1,flip?-1.4:1.4);g.add(roof);
    for(const x of [-10,-3.3,3.3,10]){const post=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,5,10),wallMat);post.position.set(x,2.6,0);g.add(post);}
    g.position.set(0,0,z);scene.add(g);
  };stand(-42,false);stand(42,true);

  const mountainMat=new THREE.MeshStandardMaterial({color:0x668399,roughness:1});
  for(let i=0;i<12;i++){const m=new THREE.Mesh(new THREE.ConeGeometry(10+(i%3)*4,25+(i%4)*5,6),mountainMat);const a=i/12*Math.PI*2;m.position.set(Math.cos(a)*88,9,Math.sin(a)*78);m.rotation.y=i*.7;scene.add(m);}
  const treeTrunk=new THREE.MeshStandardMaterial({color:0x65472f,roughness:1}),treeLeaf=new THREE.MeshStandardMaterial({color:0x245c38,roughness:.95});
  for(let i=0;i<34;i++){const a=i/34*Math.PI*2,r=50+(i%5)*2;const g=new THREE.Group();const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.28,.42,3.8,10),treeTrunk);trunk.position.y=1.9;g.add(trunk);for(let j=0;j<3;j++){const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(1.55-j*.15,1),treeLeaf);crown.position.set((j-1)*.45,4.2+j*.45,(j%2?-.25:.2));crown.scale.set(1,1.25,1);g.add(crown);}g.position.set(Math.cos(a)*r,0,Math.sin(a)*r);scene.add(g);}

  const signCanvas=document.createElement("canvas");signCanvas.width=1024;signCanvas.height=256;const sctx=signCanvas.getContext("2d")!;
  sctx.fillStyle="#08111f";sctx.fillRect(0,0,1024,256);const grad=sctx.createLinearGradient(0,0,1024,0);grad.addColorStop(0,"#22d3ee");grad.addColorStop(.5,"#ffffff");grad.addColorStop(1,"#f472b6");sctx.fillStyle=grad;sctx.font="900 106px system-ui";sctx.textAlign="center";sctx.textBaseline="middle";sctx.fillText("PRISM PAINTBALL",512,128);
  const signTex=new THREE.CanvasTexture(signCanvas);signTex.colorSpace=THREE.SRGBColorSpace;const sign=new THREE.Mesh(new THREE.PlaneGeometry(18,4.5),new THREE.MeshBasicMaterial({map:signTex}));sign.position.set(0,9,-31.55);scene.add(sign);

  const splashColors=[0x22d3ee,0xec4899,0xfacc15,0xa855f7];
  for(let i=0;i<75;i++){const s=new THREE.Mesh(new THREE.CircleGeometry(.12+(i%5)*.045,12),new THREE.MeshBasicMaterial({color:splashColors[i%4],transparent:true,opacity:.6,depthWrite:false}));s.rotation.x=-Math.PI/2;s.position.set(-28+(i*17)%56,.025,-28+(i*29)%56);s.rotation.z=i*.9;scene.add(s);}

  const playerGroups=new Map<number,THREE.Group>();
  const particles:{mesh:THREE.Mesh;vel:THREE.Vector3;life:number}[]=[];
  const keys=new Set<string>();let yaw=0,localX=0,localZ=0,initialized=false;
  const ensurePlayers=()=>{
    for(const p of roomRef.current.players){if(!playerGroups.has(p.id)){const g=makeCharacter(p.team,p.name);scene.add(g);playerGroups.set(p.id,g);}}
    for(const [id,g] of playerGroups){if(!roomRef.current.players.some(p=>p.id===id)){scene.remove(g);playerGroups.delete(id);}}
  };ensurePlayers();

  const resize=()=>{if(!renderer)return;const w=mount.clientWidth,h=mount.clientHeight;camera.aspect=w/Math.max(1,h);camera.updateProjectionMatrix();renderer.setSize(w,h,false)};resize();addEventListener("resize",resize);
  const down=(e:KeyboardEvent)=>keys.add(e.key.toLowerCase()),up=(e:KeyboardEvent)=>keys.delete(e.key.toLowerCase());addEventListener("keydown",down);addEventListener("keyup",up);
  const mouse=(e:MouseEvent)=>{if(document.pointerLockElement===renderer?.domElement)yaw-=e.movementX*.00215};addEventListener("mousemove",mouse);
  const fireFX=()=>{
    for(let i=0;i<18;i++){const m=new THREE.Mesh(new THREE.SphereGeometry(.045+(i%3)*.012,7,6),new THREE.MeshBasicMaterial({color:splashColors[i%4]}));const side=(Math.random()-.5)*.05;const dir=new THREE.Vector3(Math.sin(yaw)+side,.04+Math.random()*.045,Math.cos(yaw)+side).normalize();m.position.set(localX+Math.sin(yaw)*.6,.95,localZ+Math.cos(yaw)*.6);scene.add(m);particles.push({mesh:m,vel:dir.multiplyScalar(18+Math.random()*5),life:.52});}
  };
  const pointerDown=(e:PointerEvent)=>{if(e.button===0&&document.pointerLockElement===renderer?.domElement){shootRef.current(yaw);fireFX();}else if(e.button===0&&!phone)renderer?.domElement.requestPointerLock?.();};renderer.domElement.addEventListener("pointerdown",pointerDown);

  const clock=new THREE.Clock();
  const animate=()=>{if(!renderer)return;const dt=Math.min(clock.getDelta(),.04),now=performance.now();ensurePlayers();const state=roomRef.current;const me=state.players.find(p=>p.id===myId);
   if(me){
    if(!initialized){localX=me.x;localZ=me.z;yaw=me.rot;initialized=true;}if(me.respawnAt){localX=me.x;localZ=me.z;}
    const m=mobileRef.current;const f=(keys.has("w")||keys.has("arrowup")||m.forward?1:0)-(keys.has("s")||keys.has("arrowdown")||m.back?1:0);const r=(keys.has("d")||keys.has("arrowright")||m.right?1:0)-(keys.has("a")||keys.has("arrowleft")||m.left?1:0);const sprint=keys.has("shift")||m.sprint;const mag=Math.hypot(f,r);const moving=mag>.01&&!me.respawnAt;
    if(moving){const speed=(sprint?8.7:6.2)*dt,nf=f/mag,nr=r/mag;localX+=(Math.sin(yaw)*nf+Math.cos(yaw)*nr)*speed;localZ+=(Math.cos(yaw)*nf-Math.sin(yaw)*nr)*speed;localX=Math.max(-27.8,Math.min(27.8,localX));localZ=Math.max(-27.8,Math.min(27.8,localZ));}
    if(phone&&Math.abs(r)>.1)yaw-=r*dt*1.5;
    if(now-lastSend>110){lastSend=now;moveRef.current(localX,localZ,yaw,moving,sprint);}
    for(const p of state.players){
      const g=playerGroups.get(p.id);if(!g)continue;const targetX=p.id===myId?localX:p.x,targetZ=p.id===myId?localZ:p.z;g.position.x+=(targetX-g.position.x)*Math.min(1,dt*12);g.position.z+=(targetZ-g.position.z)*Math.min(1,dt*12);g.rotation.y=p.id===myId?yaw:p.rot;g.visible=!p.respawnAt;
      const d=g.userData as any,walk=p.id===myId?moving:p.moving;
      if(walk){d.step+=dt*(p.sprinting?12.5:8.7);const swing=Math.sin(d.step)*.72;d.armL.rotation.x=swing*.72-.18;d.armR.rotation.x=-swing*.55-.45;d.legL.rotation.x=-swing;d.legR.rotation.x=swing;d.torso.rotation.z=Math.sin(d.step*.5)*.025;d.torso.rotation.x=p.sprinting?.08:.035;g.position.y=Math.abs(Math.sin(d.step*2))*.035;}
      else{d.armL.rotation.x+=(0-d.armL.rotation.x)*.16;d.armR.rotation.x+=(-.35-d.armR.rotation.x)*.16;d.legL.rotation.x*=.8;d.legR.rotation.x*=.8;d.torso.rotation.z*=.82;d.torso.rotation.x*=.82;g.position.y*=.82;}
    }
    const back=phone?9.8:10.8,side=phone?1.2:1.75,height=phone?4.7:5.1;
    const tx=localX-Math.sin(yaw)*back+Math.cos(yaw)*side,tz=localZ-Math.cos(yaw)*back-Math.sin(yaw)*side;
    camera.position.x+=(tx-camera.position.x)*Math.min(1,dt*7.2);camera.position.z+=(tz-camera.position.z)*Math.min(1,dt*7.2);camera.position.y+=(height-camera.position.y)*Math.min(1,dt*5.5);
    camera.lookAt(localX+Math.sin(yaw)*3.4,1.35,localZ+Math.cos(yaw)*3.4);
   }
   for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;p.vel.y-=2.2*dt;p.mesh.position.addScaledVector(p.vel,dt);if(p.life<=0){scene.remove(p.mesh);p.mesh.geometry.dispose();(p.mesh.material as THREE.Material).dispose();particles.splice(i,1);}}
   renderer.render(scene,camera);raf=requestAnimationFrame(animate);
  };animate();

  return()=>{cancelAnimationFrame(raf);removeEventListener("resize",resize);removeEventListener("keydown",down);removeEventListener("keyup",up);removeEventListener("mousemove",mouse);renderer?.domElement.removeEventListener("pointerdown",pointerDown);try{document.exitPointerLock?.()}catch{};scene.traverse(o=>{const m=o as THREE.Mesh;m.geometry?.dispose?.();if(m.material)(Array.isArray(m.material)?m.material:[m.material]).forEach(mat=>{if("map" in mat)(mat as THREE.MeshBasicMaterial).map?.dispose?.();mat.dispose();});});renderer?.dispose();mount.replaceChildren();};
 },[]);
 return <div ref={host} className="absolute inset-0 bg-sky-300"/>;
}

export default function PaintballArena(){
 const {user,token}=useAuth();const [,navigate]=useLocation();
 const [room,setRoom]=useState<Room|null>(null),[lobbies,setLobbies]=useState<Lobby[]>([]),[code,setCode]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const [mobile,setMobile]=useState<MobileInput>({forward:false,back:false,left:false,right:false,sprint:false});
 const myId=Number(user?.id),me=room?.players.find(p=>p.id===myId),host=room?.hostId===myId;
 const roomRef=useRef(room);roomRef.current=room;
 const action=async(body:any)=>{const r=roomRef.current;if(!r||!token)return;try{const res=await fetch(API_BASE+"/api/paintball/rooms/"+r.code+"/action",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify(body)});const data=await res.json();if(res.ok)setRoom(data);else setError(data.message||"Action failed.");}catch{}};
 const enter=async(kind:"queue"|"create"|"practice"|"join",selectedCode=code)=>{if(!token||busy)return;setBusy(true);setError("");try{const path=kind==="queue"?"/api/paintball/queue":kind==="join"?"/api/paintball/rooms/"+selectedCode+"/join":"/api/paintball/rooms";const res=await fetch(API_BASE+path,{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify(kind==="practice"?{practice:true}:{publicLobby:kind==="create"})});const data=await res.json();if(res.ok)setRoom(data);else setError(data.message||"Could not enter Paintball Arena.");}catch{setError("Could not reach Paintball Arena.")}finally{setBusy(false)}};
 useEffect(()=>{if(room||!token)return;let stop=false;const load=async()=>{try{const r=await fetch(API_BASE+"/api/paintball/lobbies",{headers:{Authorization:"Bearer "+token}});if(r.ok&&!stop)setLobbies(await r.json())}catch{}};load();const t=setInterval(load,3000);return()=>{stop=true;clearInterval(t)}},[!!room,token]);
 useEffect(()=>{if(!room?.code||!token)return;let stop=false;const poll=async()=>{try{const r=await fetch(API_BASE+"/api/paintball/rooms/"+room.code,{headers:{Authorization:"Bearer "+token},cache:"no-store"});const data=await r.json();if(r.ok&&!stop)setRoom(data);else if(!stop&&r.status===409){setRoom(null);setError(data.message||"Room ended.");}}catch{}if(!stop)setTimeout(poll,180)};const t=setTimeout(poll,180);return()=>{stop=true;clearTimeout(t)}},[room?.code,token]);
 const leave=()=>{if(room&&token)void fetch(API_BASE+"/api/paintball/rooms/"+room.code+"/leave",{method:"POST",headers:{Authorization:"Bearer "+token},keepalive:true});setRoom(null);navigate("/worlds")};
 const setPress=(key:keyof MobileInput,value:boolean)=>setMobile(m=>({...m,[key]:value}));
 const time=room?Math.ceil(room.timeLeft/1000):0;

 if(!room)return <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_20%_10%,#164e63,transparent_28%),radial-gradient(circle_at_85%_8%,#831843,transparent_27%),linear-gradient(#050816,#10182c)] p-4 text-white sm:p-8">
  <button onClick={()=>navigate("/worlds")} className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 font-black"><ArrowLeft className="mr-2 inline h-5 w-5"/> Worlds</button>
  <section className="mx-auto mt-5 max-w-6xl overflow-hidden rounded-[2.5rem] border border-white/10 bg-slate-950/70 shadow-[0_40px_100px_rgba(0,0,0,.55)] backdrop-blur-xl">
   <div className="relative min-h-[360px] overflow-hidden bg-[linear-gradient(120deg,rgba(34,211,238,.16),transparent_46%),linear-gradient(240deg,rgba(236,72,153,.17),transparent_48%),#080d18] p-7 sm:p-12">
    <div className="absolute inset-0 opacity-25 [background-image:radial-gradient(circle_at_30%_30%,#22d3ee_0_3px,transparent_4px),radial-gradient(circle_at_70%_50%,#ec4899_0_4px,transparent_5px)] [background-size:55px_55px,71px_71px]"/>
    <div className="relative max-w-3xl"><p className="text-xs font-black uppercase tracking-[.3em] text-cyan-300">A.R.I.S.E. competitive world</p><h1 className="mt-3 text-5xl font-black tracking-[-.05em] sm:text-8xl">PRISM<br/><span className="text-cyan-300">PAINTBALL</span></h1><p className="mt-5 max-w-2xl text-base font-bold leading-7 text-slate-300 sm:text-xl">Fast third-person team paintball with real multiplayer rooms, animated runners, towers, cover, respawns, live scores, and a bright outdoor arena.</p><div className="mt-5 flex flex-wrap gap-2 text-xs font-black"><span className="rounded-full bg-cyan-400/15 px-3 py-2 text-cyan-200">REAL MULTIPLAYER</span><span className="rounded-full bg-pink-400/15 px-3 py-2 text-pink-200">NO GORE</span><span className="rounded-full bg-white/10 px-3 py-2">WASD + TOUCH</span><span className="rounded-full bg-white/10 px-3 py-2">5 MINUTE MATCHES</span></div></div>
   </div>
   <div className="grid gap-4 p-5 sm:p-8 md:grid-cols-[1.1fr_.9fr]"><div><button disabled={busy} onClick={()=>enter("queue")} className="min-h-16 w-full rounded-2xl bg-cyan-300 text-xl font-black text-slate-950 shadow-lg"><Users className="mr-2 inline"/> Join multiplayer match</button><div className="mt-3 grid gap-2">{lobbies.slice(0,5).map(l=><button key={l.code} onClick={()=>{setCode(l.code);void enter("join",l.code)}} className="flex min-h-14 items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 text-left"><span><b>{l.hostName}'s arena</b><small className="block text-slate-500">{l.players}/8 players</small></span><span className="font-black text-cyan-300">JOIN</span></button>)}</div></div><div className="rounded-2xl border border-white/10 bg-white/[.04] p-4"><button disabled={busy} onClick={()=>enter("practice")} className="min-h-12 w-full rounded-xl bg-violet-500 font-black">Practice vs computer squad</button><button disabled={busy} onClick={()=>enter("create")} className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-white/5 font-black">Create open room</button><div className="mt-3 flex gap-2"><input value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))} placeholder="6-digit room" className="min-h-12 min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-900 px-3"/><button disabled={busy||code.length!==6} onClick={()=>enter("join")} className="rounded-xl bg-amber-300 px-4 font-black text-slate-950">Join</button></div></div></div>
   {error&&<p className="mx-5 mb-5 rounded-xl bg-red-500/10 p-3 font-bold text-red-200 sm:mx-8">{error}</p>}
  </section>
 </main>;

 if(room.phase==="lobby")return <main className="min-h-screen bg-[#050816] p-4 text-white sm:p-8"><button onClick={leave} className="rounded-xl bg-white/5 px-4 py-3 font-black"><ArrowLeft className="mr-2 inline h-4 w-4"/> Worlds</button><section className="mx-auto mt-5 max-w-5xl rounded-[2.2rem] border border-white/10 bg-slate-950/80 p-5 shadow-2xl sm:p-8"><p className="text-xs font-black uppercase tracking-[.25em] text-cyan-300">Paintball room {room.code}</p><h1 className="mt-2 text-4xl font-black">Choose your team</h1><div className="mt-6 grid gap-4 md:grid-cols-2">{(["cyan","magenta"] as Team[]).map(team=><div key={team} className={"rounded-2xl border p-4 "+(team==="cyan"?"border-cyan-300/25 bg-cyan-400/5":"border-pink-300/25 bg-pink-400/5")}><h2 className="text-2xl font-black uppercase">{team} squad</h2>{room.players.filter(p=>p.team===team).map(p=><div key={p.id} className="mt-2 flex items-center justify-between rounded-xl bg-black/25 px-3 py-3"><span><b>{p.name}{p.id===myId?" · YOU":""}</b><small className="block text-slate-500">{p.bot?"Computer player":p.id===room.hostId?"Host":"Player"}</small></span></div>)}</div>)}</div><div className="mt-5 flex flex-wrap gap-2">{me&&<button onClick={()=>action({type:"switch-team"})} className="min-h-12 rounded-xl border border-white/15 bg-white/5 px-4 font-black">Switch team</button>}{host&&<button onClick={()=>action({type:"add-bots",count:6})} className="min-h-12 rounded-xl border border-white/15 bg-white/5 px-4 font-black">Fill with computer players</button>}{host?<button disabled={room.players.length<2} onClick={()=>action({type:"start"})} className="min-h-12 flex-1 rounded-xl bg-cyan-300 px-5 font-black text-slate-950"><Play className="mr-2 inline h-4 w-4"/> Start match</button>:<p className="py-3 font-black text-slate-400">Waiting for host…</p>}</div>{error&&<p className="mt-4 rounded-xl bg-red-500/10 p-3 text-red-200">{error}</p>}</section></main>;

 return <main className="relative h-[100dvh] overflow-hidden bg-slate-950 text-white">
  <PaintballScene room={room} myId={myId} mobile={mobile} onMove={(x,z,rot,moving,sprinting)=>void action({type:"move",x,z,rot,moving,sprinting})} onShoot={rot=>void action({type:"shoot",rot})}/>
  <div className="pointer-events-none absolute inset-0 z-[5] bg-[radial-gradient(circle_at_50%_45%,transparent_48%,rgba(2,6,23,.12)_82%,rgba(2,6,23,.26)_100%)]"/>
  <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start gap-2 p-3 sm:p-4"><button onClick={leave} className="pointer-events-auto rounded-xl border border-white/10 bg-black/65 px-3 py-2 font-black backdrop-blur"><LogOut className="mr-1 inline h-4 w-4"/> Exit</button><div className="mx-auto flex items-center gap-2 rounded-2xl border border-white/10 bg-black/65 px-4 py-2 shadow-xl backdrop-blur"><div className="text-center"><small className="block text-[9px] font-black uppercase text-cyan-300">CYAN</small><b className="text-2xl">{room.scores.cyan}</b></div><div className="px-3 text-center"><small className="block text-[9px] font-black uppercase text-slate-400">TIME</small><b className="text-2xl">{Math.floor(time/60)}:{String(time%60).padStart(2,"0")}</b></div><div className="text-center"><small className="block text-[9px] font-black uppercase text-pink-300">MAGENTA</small><b className="text-2xl">{room.scores.magenta}</b></div></div><div className="rounded-xl border border-white/10 bg-black/65 px-3 py-2 text-right backdrop-blur"><b className="block">{me?.name}</b><small className="font-bold text-slate-400">{me?.tags||0} tags · {me?.downs||0} tagged</small></div></header>
  <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2"><Crosshair className="h-9 w-9 text-white drop-shadow-[0_2px_6px_rgba(0,0,0,.8)]"/></div>
  <div className="absolute bottom-4 left-4 z-30 hidden rounded-xl border border-white/10 bg-black/55 px-3 py-2 text-xs font-black backdrop-blur md:block">WASD move · Shift sprint · Mouse aim · Click fire</div>
  <div className="absolute bottom-4 left-4 z-30 grid grid-cols-3 gap-2 md:hidden"><span/><button onPointerDown={()=>setPress("forward",true)} onPointerUp={()=>setPress("forward",false)} onPointerCancel={()=>setPress("forward",false)} className="h-14 w-14 rounded-2xl bg-black/65 font-black backdrop-blur">▲</button><span/><button onPointerDown={()=>setPress("left",true)} onPointerUp={()=>setPress("left",false)} onPointerCancel={()=>setPress("left",false)} className="h-14 w-14 rounded-2xl bg-black/65 font-black backdrop-blur">◀</button><button onPointerDown={()=>setPress("back",true)} onPointerUp={()=>setPress("back",false)} onPointerCancel={()=>setPress("back",false)} className="h-14 w-14 rounded-2xl bg-black/65 font-black backdrop-blur">▼</button><button onPointerDown={()=>setPress("right",true)} onPointerUp={()=>setPress("right",false)} onPointerCancel={()=>setPress("right",false)} className="h-14 w-14 rounded-2xl bg-black/65 font-black backdrop-blur">▶</button></div>
  <div className="absolute bottom-5 right-4 z-30 flex gap-2 md:hidden"><button onPointerDown={()=>setPress("sprint",true)} onPointerUp={()=>setPress("sprint",false)} className="h-16 w-16 rounded-full border-2 border-white/20 bg-amber-400/85 text-xs font-black text-slate-950 shadow-xl">RUN</button><button onClick={()=>action({type:"shoot",rot:me?.rot||0})} className="h-20 w-20 rounded-full border-4 border-white bg-pink-500 font-black shadow-2xl">FIRE</button></div>
  {me?.respawnAt? <div className="pointer-events-none absolute left-1/2 top-24 z-40 -translate-x-1/2 rounded-2xl border border-cyan-300/25 bg-slate-950/88 px-5 py-3 text-center shadow-2xl backdrop-blur-md"><div className="flex items-center gap-3"><Shield className="h-7 w-7 text-cyan-300"/><div className="text-left"><h2 className="text-base font-black">Paint tagged — respawning</h2><p className="text-xs font-bold text-slate-400">Back at your team base in a moment</p></div></div></div>:null}
  {room.phase==="finished"&&<div className="absolute inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur"><div className="max-w-lg rounded-[2.2rem] border border-white/15 bg-slate-950/95 p-8 text-center shadow-2xl"><h2 className="text-5xl font-black">{room.winner?room.winner.toUpperCase()+" WINS!":"DRAW!"}</h2><p className="mt-3 text-xl font-bold text-slate-300">{room.scores.cyan} – {room.scores.magenta}</p>{host?<button onClick={()=>action({type:"restart"})} className="mt-5 min-h-14 w-full rounded-xl bg-cyan-300 font-black text-slate-950"><RotateCcw className="mr-2 inline"/> Play again</button>:<p className="mt-4 font-bold text-slate-400">Waiting for host…</p>}</div></div>}
 </main>;
}
