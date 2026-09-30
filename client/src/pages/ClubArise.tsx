import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { ArrowLeft, Film, Gamepad2, MessageCircle, Trophy, UserRound, Users, X, Zap } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";
import { getAvatarCharacter } from "@/lib/avatarCharacters";
import { createPet, openPetCare, PET_PERSONALITIES } from "@/lib/pets";
import { createWorldModel } from "@/lib/worldModels";
import { createWorldExit } from "@/lib/worldPortal";
import WorldLoadingOverlay from "@/components/WorldLoadingOverlay";
import MobileJoystick from "@/components/MobileJoystick";

type Player={
  user_id:number;display_name:string;character_id:string;pet_id?:string|null;x:number;z:number;facing:number;
  car_id?:string;driving?:boolean;phrase?:string|null;phrase_at?:string|null;emote?:string|null;emote_at?:string|null;updated_at:string;
};
type GameType="four"|"word_tiles"|"word_rescue"|"math_duel"|"synonym_sprint"|"pattern_power"|"sentence_fix"|"fact_dash";
type Match={id:string;game_type:GameType;status:string;player1_id:number;player2_id:number|null;state:any;winner_id:number|null;players?:Array<{user_id:number;display_name:string;character_id:string}>};
type PlayerProfile={
  userId:number;displayName:string;characterId:string;leaderboardPoints:number;quizzesTaken:number;
  club:{played:number;wins:number;ties:number;losses:number;score:number;byGame:Record<string,{played:number;wins:number}>};
};
type Station={id:GameType;name:string;subtitle:string;x:number;z:number};
type CarTransition={kind:"enter"|"exit";started:number;from:THREE.Vector3;door:THREE.Vector3;car:THREE.Vector3};

const STATIONS:Station[]=[
  {id:"four",name:"Four in a Row",subtitle:"Strategy · patterns · planning",x:-12,z:-7},
  {id:"word_tiles",name:"Word Tiles",subtitle:"Vocabulary · spelling · word play",x:12,z:-7},
  {id:"word_rescue",name:"Word Rescue",subtitle:"Letters · clues · vocabulary",x:0,z:-15},
  {id:"math_duel",name:"Math Duel",subtitle:"Fast math · accuracy · strategy",x:-22,z:4},
  {id:"synonym_sprint",name:"Synonym Sprint",subtitle:"Vocabulary · word meaning",x:22,z:4},
  {id:"pattern_power",name:"Pattern Power",subtitle:"Sequences · logic · prediction",x:-22,z:-11},
  {id:"sentence_fix",name:"Sentence Fix",subtitle:"Grammar · punctuation · editing",x:22,z:-11},
  {id:"fact_dash",name:"Fact Dash",subtitle:"Science · knowledge · quick thinking",x:0,z:13},
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
function addNeonBox(scene:THREE.Scene,size:[number,number,number],pos:[number,number,number],color:number,intensity=2.4){
  const m=new THREE.Mesh(new THREE.BoxGeometry(...size),new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:intensity,roughness:.35}));
  m.position.set(...pos);scene.add(m);return m;
}
function stationColor(id:Station["id"]){
  if(id==="four")return 0x2563eb;
  if(id==="word_tiles")return 0x7c3aed;
  if(id==="word_rescue")return 0x059669;
  if(id==="math_duel")return 0xf59e0b;
  if(id==="synonym_sprint")return 0xec4899;
  if(id==="pattern_power")return 0x06b6d4;
  if(id==="sentence_fix")return 0x8b5cf6;
  return 0xef4444;
}

function addDiscoBall(scene:THREE.Scene,x:number,y:number,z:number,r=1){
  const geo=new THREE.SphereGeometry(r,24,18);
  const mat=new THREE.MeshStandardMaterial({color:0xdbeafe,metalness:1,roughness:.18,emissive:0x334155,emissiveIntensity:.35});
  const ball=new THREE.Mesh(geo,mat);ball.position.set(x,y,z);ball.castShadow=true;scene.add(ball);
  const wire=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(.01,y-1,.01)),new THREE.LineBasicMaterial({color:0x94a3b8}));
  wire.position.set(x,y+(y-1)/2,z);scene.add(wire);
  return ball;
}
function addChair(scene:THREE.Scene,x:number,z:number,rotation=0,color=0x5b21b6){
  const root=new THREE.Group();root.position.set(x,0,z);root.rotation.y=rotation;scene.add(root);
  const seat=new THREE.Mesh(new THREE.BoxGeometry(1.6,.35,1.5),new THREE.MeshStandardMaterial({color,roughness:.55}));
  seat.position.y=.72;seat.castShadow=true;root.add(seat);
  const back=new THREE.Mesh(new THREE.BoxGeometry(1.6,1.45,.35),new THREE.MeshStandardMaterial({color,roughness:.55}));
  back.position.set(0,1.35,-.58);back.rotation.x=-.1;back.castShadow=true;root.add(back);
  for(const sx of [-.62,.62])for(const sz of [-.52,.52]){
    const leg=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,.68,10),new THREE.MeshStandardMaterial({color:0x111827,metalness:.8,roughness:.3}));
    leg.position.set(sx,.34,sz);root.add(leg);
  }
  return root;
}
function addLoungeTable(scene:THREE.Scene,x:number,z:number){
  const top=new THREE.Mesh(new THREE.CylinderGeometry(1.05,1.05,.14,32),new THREE.MeshStandardMaterial({color:0x111827,metalness:.55,roughness:.35}));
  top.position.set(x,.8,z);scene.add(top);
  const stem=new THREE.Mesh(new THREE.CylinderGeometry(.12,.18,.75,16),new THREE.MeshStandardMaterial({color:0x64748b,metalness:.85,roughness:.25}));
  stem.position.set(x,.4,z);scene.add(stem);
  const lamp=new THREE.PointLight(0xf472b6,2.2,4,2);lamp.position.set(x,1.4,z);scene.add(lamp);
}
function addArcadeCabinet(scene:THREE.Scene,station:Station){
  const color=stationColor(station.id);
  const root=new THREE.Group();root.position.set(station.x,0,station.z);root.userData.stationId=station.id;scene.add(root);
  const shell=new THREE.Mesh(new THREE.BoxGeometry(3.35,3.6,2.05),new THREE.MeshStandardMaterial({color:0x0f172a,metalness:.4,roughness:.4}));
  shell.position.y=1.8;shell.castShadow=true;root.add(shell);
  const marquee=new THREE.Mesh(new THREE.BoxGeometry(3.15,.72,2.18),new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:2.4,roughness:.3}));
  marquee.position.y=3.75;root.add(marquee);
  const screenFrame=new THREE.Mesh(new THREE.BoxGeometry(2.65,1.62,.12),new THREE.MeshStandardMaterial({color:0x020617,metalness:.55,roughness:.25}));
  screenFrame.position.set(0,2.35,1.08);root.add(screenFrame);
  const screen=new THREE.Mesh(new THREE.PlaneGeometry(2.4,1.36),new THREE.MeshBasicMaterial({color:station.id==="four"?0x1d4ed8:station.id==="word_tiles"?0x4c1d95:0x065f46}));
  screen.position.set(0,2.35,1.151);root.add(screen);
  if(station.id==="four"){
    for(let r=0;r<4;r++)for(let col=0;col<5;col++){
      const token=new THREE.Mesh(new THREE.CircleGeometry(.15,18),new THREE.MeshBasicMaterial({color:(r+col)%3===0?0xfacc15:(r+col)%3===1?0xf43f5e:0xe2e8f0}));
      token.position.set(-.78+col*.39,2.78-r*.31,1.158);root.add(token);
    }
  }else if(station.id==="word_tiles"){
    const letters=["R","E","A","D"];
    letters.forEach((letter,i)=>{
      const tile=new THREE.Mesh(new THREE.BoxGeometry(.47,.47,.08),new THREE.MeshStandardMaterial({color:0xf5deb3,roughness:.65}));
      tile.position.set(-.78+i*.52,2.35,1.16);root.add(tile);
      const tag=makeLabel(letter,"#f5deb3","#111827");tag.scale.set(.42,.42,1);tag.position.set(-.78+i*.52,2.35,1.22);root.add(tag);
    });
  }else{
    const clue=makeLabel("WORD _ E S C U E","#064e3b","#ecfdf5");clue.scale.set(2.3,.55,1);clue.position.set(0,2.35,1.18);root.add(clue);
  }
  const panel=new THREE.Mesh(new THREE.BoxGeometry(2.7,.65,1.45),new THREE.MeshStandardMaterial({color:0x1e293b,metalness:.5,roughness:.35}));
  panel.position.set(0,1.18,.7);panel.rotation.x=-.18;root.add(panel);
  const joystick=new THREE.Mesh(new THREE.CylinderGeometry(.11,.11,.36,14),new THREE.MeshStandardMaterial({color:0x111827,metalness:.6}));
  joystick.position.set(-.65,1.55,1.22);root.add(joystick);
  const knob=new THREE.Mesh(new THREE.SphereGeometry(.17,16,12),new THREE.MeshStandardMaterial({color:0xef4444,roughness:.3}));
  knob.position.set(-.65,1.78,1.22);root.add(knob);
  for(const bx of [.25,.65]){
    const button=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,.08,18),new THREE.MeshStandardMaterial({color:bx<.5?0xfacc15:0x22d3ee,emissive:bx<.5?0xfacc15:0x22d3ee,emissiveIntensity:1.5}));
    button.rotation.x=Math.PI/2;button.position.set(bx,1.48,1.33);root.add(button);
  }
  const stoolSeat=new THREE.Mesh(new THREE.CylinderGeometry(.48,.48,.18,24),new THREE.MeshStandardMaterial({color:0xef4444,roughness:.5}));
  stoolSeat.position.set(0,.72,2.25);root.add(stoolSeat);
  const stoolLeg=new THREE.Mesh(new THREE.CylinderGeometry(.08,.13,.68,14),new THREE.MeshStandardMaterial({color:0x475569,metalness:.8}));
  stoolLeg.position.set(0,.34,2.25);root.add(stoolLeg);

  // Cover the cabinet without extending far onto the surrounding floor.
  const hitbox=new THREE.Mesh(
    new THREE.BoxGeometry(3.8,4.3,2.7),
    new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false})
  );
  hitbox.position.set(0,2.1,.2);
  hitbox.userData.stationId=station.id;
  root.add(hitbox);
  return root;
}

function attachAvatarMotion(root:THREE.Group,model:THREE.Group,animations:THREE.AnimationClip[]){
  if(!animations.length)return;
  const mixer=new THREE.AnimationMixer(model);
  const idleClip=animations.find(clip=>clip.name==="Idle_Neutral")||animations.find(clip=>clip.name==="Idle")||animations[0];
  const idle=mixer.clipAction(idleClip);idle.play();
  root.userData.mixer=mixer;
  root.userData.idle=idle;
  root.userData.animations=animations;
}

function setAvatarGesture(root:THREE.Group,name:string|null){
  const mixer=root.userData.mixer as THREE.AnimationMixer|undefined;
  if(!mixer)return;
  const idle=root.userData.idle as THREE.AnimationAction;
  const current=root.userData.gesture as THREE.AnimationAction|undefined;
  current?.stop();
  if(!name){idle.reset().play();root.userData.gesture=null;return;}
  const clipName=name==="dance"?"Wave":name==="flip"?"Roll":name==="jump"?"Kick_Right":"Kick_Left";
  const clip=(root.userData.animations as THREE.AnimationClip[]).find(item=>item.name===clipName);
  if(!clip)return;
  idle.stop();
  const action=mixer.clipAction(clip).reset();
  action.setLoop(name==="dance"||name==="silly"?THREE.LoopRepeat:THREE.LoopOnce,name==="dance"||name==="silly"?Infinity:1);
  action.clampWhenFinished=true;
  action.play();root.userData.gesture=action;
}

function playFunnyEmoteMusic(kind:string){
  try{
    const AudioCtx=(window.AudioContext||(window as any).webkitAudioContext);
    if(!AudioCtx)return;
    const ctx=new AudioCtx();
    const notes=kind==="dance"?[392,523,659,523,784]:kind==="flip"?[330,440,660,880]:kind==="jump"?[440,660,880]:[523,392,659,330,784];
    notes.forEach((freq,i)=>{
      const osc=ctx.createOscillator(),gain=ctx.createGain();
      osc.type=i%2?"square":"sine";osc.frequency.value=freq;
      gain.gain.setValueAtTime(.0001,ctx.currentTime+i*.11);
      gain.gain.exponentialRampToValueAtTime(.075,ctx.currentTime+i*.11+.015);
      gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+i*.11+.1);
      osc.connect(gain);gain.connect(ctx.destination);osc.start(ctx.currentTime+i*.11);osc.stop(ctx.currentTime+i*.11+.11);
    });
    window.setTimeout(()=>void ctx.close(),1400);
  }catch{}
}

export default function ClubArise(){
  const {token,user}=useAuth();
  const [,navigate]=useLocation();
  const mountRef=useRef<HTMLDivElement>(null);
  const rendererRef=useRef<THREE.WebGLRenderer|null>(null);
  const cameraRef=useRef<THREE.PerspectiveCamera|null>(null);
  const controlsRef=useRef<OrbitControls|null>(null);
  const sceneRef=useRef<THREE.Scene|null>(null);
  const selfRootRef=useRef<THREE.Group|null>(null);
  const selfCarRef=useRef<THREE.Group|null>(null);
  const drivingRef=useRef(false);
  const [driving,setDriving]=useState(false);
  const carTransitionRef=useRef<CarTransition|null>(null);
  const [carTransition,setCarTransition]=useState<"enter"|"exit"|null>(null);
  const remoteRootsRef=useRef<Map<number,THREE.Group>>(new Map());
  const targetRef=useRef(new THREE.Vector3(0,0,7));
  const keysRef=useRef(new Set<string>());
  const lastSyncRef=useRef(0);
  const selfEmoteRef=useRef<{name:string;started:number}|null>(null);
  const [ready,setReady]=useState(false);
  const [players,setPlayers]=useState<Player[]>([]);
  const playersRef=useRef<Player[]>([]);
  playersRef.current=players;
  const [self,setSelf]=useState<{userId:number;displayName:string;characterId:string;petId?:string;carId?:string;homeId?:string}|null>(null);
  const [phrases,setPhrases]=useState<string[]>([]);
  const [nearStation,setNearStation]=useState<Station|null>(null);
  const [match,setMatch]=useState<Match|null>(null);
  const [gameOpen,setGameOpen]=useState(false);
  const [notice,setNotice]=useState("Tap a cabinet or choose a game below. Press Play to start.");
  const [selectedPlayer,setSelectedPlayer]=useState<PlayerProfile|null>(null);
  const [selectedPlayerId,setSelectedPlayerId]=useState<number|null>(null);
  const [playerLoading,setPlayerLoading]=useState(false);
  const [showReaders,setShowReaders]=useState(false);
  const [cameraMode,setCameraMode]=useState<"pan"|"rotate">("pan");
  const [showMobileChat,setShowMobileChat]=useState(false);
  const [showMobileCamera,setShowMobileCamera]=useState(false);
  const [showArcade,setShowArcade]=useState(false);
  const [showEmotes,setShowEmotes]=useState(false);
  const [access,setAccess]=useState<any>(null);
  const [leavingWorld,setLeavingWorld]=useState(false);

  const headers=useMemo(()=>({Authorization:"Bearer "+token,"Content-Type":"application/json"}),[token]);

  useEffect(()=>{
    if(!leavingWorld)return;
    const timer=window.setTimeout(()=>navigate("/worlds"),800);
    return()=>window.clearTimeout(timer);
  },[leavingWorld,navigate]);

  const viewPlayer=async(uid:number)=>{
    setSelectedPlayerId(uid);setSelectedPlayer(null);setPlayerLoading(true);setShowReaders(false);setNearStation(null);
    try{
      const response=await fetch(API_BASE+"/api/club-arise/players/"+uid+"/profile",{headers:{Authorization:"Bearer "+token},cache:"no-store"});
      const data=await response.json();
      if(response.ok)setSelectedPlayer(data);else setNotice(data.message||"Could not load player.");
    }catch{setNotice("Could not load player.");}
    finally{setPlayerLoading(false);}
  };

  const walkToPlayer=(uid:number)=>{
    const player=playersRef.current.find(p=>p.user_id===uid);
    if(!player){setNotice("That reader is no longer online.");return;}
    const selfPosition=selfRootRef.current?.position;
    const towardSelf=selfPosition?new THREE.Vector3(selfPosition.x-player.x,0,selfPosition.z-player.z):new THREE.Vector3(1,0,0);
    if(towardSelf.lengthSq()<.01)towardSelf.set(1,0,0);
    towardSelf.normalize().multiplyScalar(2.2);
    targetRef.current.set(THREE.MathUtils.clamp(player.x+towardSelf.x,-28,28),0,THREE.MathUtils.clamp(player.z+towardSelf.z,-27,27));
    const controls=controlsRef.current,camera=cameraRef.current;
    if(controls&&camera){const center=new THREE.Vector3((player.x+(selfPosition?.x??player.x))/2,1.3,(player.z+(selfPosition?.z??player.z))/2);camera.position.add(center.clone().sub(controls.target));controls.target.copy(center);controls.update();}
    setNotice("Walking over to "+player.display_name+"…");
  };

  const centerOnMe=()=>{
    const root=selfRootRef.current,controls=controlsRef.current,camera=cameraRef.current;
    if(!root||!controls||!camera)return;
    const center=new THREE.Vector3(root.position.x,1.3,root.position.z);
    camera.position.add(center.clone().sub(controls.target));controls.target.copy(center);controls.update();
  };

  const toggleDriving=()=>{
    const root=selfRootRef.current,car=selfCarRef.current;if(!root||!car||carTransitionRef.current)return;
    const kind=drivingRef.current?"exit":"enter";
    const carPosition=car.position.clone();
    const door=carPosition.clone().add(new THREE.Vector3(-1.8,0,0).applyAxisAngle(new THREE.Vector3(0,1,0),car.rotation.y));
    carTransitionRef.current={kind,started:performance.now(),from:root.position.clone(),door,car:carPosition};
    setCarTransition(kind);
    targetRef.current.copy(root.position);
    const sign=car.getObjectByName("carSign");if(sign)sign.visible=false;
    const visual=root.userData.avatarVisual as THREE.Group|undefined;
    if(kind==="exit"&&visual){visual.visible=true;visual.position.set(0,.45,0);visual.scale.setScalar(.65);}
    if(kind==="enter"){
      selfEmoteRef.current=null;setAvatarGesture(root,null);root.rotation.z=0;root.scale.set(1,1,1);root.position.y=0;
      const animations=root.userData.animations as THREE.AnimationClip[]|undefined;
      const walk=animations?.find(clip=>/walk/i.test(clip.name));
      const mixer=root.userData.mixer as THREE.AnimationMixer|undefined;
      if(walk&&mixer){(root.userData.idle as THREE.AnimationAction|undefined)?.stop();const action=mixer.clipAction(walk).reset().play();root.userData.travelAction=action;}
    }
    setNotice(kind==="enter"?"Walking to your car…":"Climbing out of your car…");
  };

  useEffect(()=>{
    if(!token)return;
    fetch(API_BASE+"/api/club-arise/bootstrap",{headers:{Authorization:"Bearer "+token},cache:"no-store"})
      .then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.message);return d;})
      .then(d=>{setSelf(d.self);setPlayers(d.players||[]);setPhrases(d.safePhrases||[]);setAccess(d.access||null);})
      .catch(e=>setNotice(e.message||"Could not enter A.R.I.S.E Arcade"));
  },[token]);

  useEffect(()=>{
    const mount=mountRef.current;if(!mount||!self)return;
    let disposed=false;
    const scene=new THREE.Scene();scene.background=new THREE.Color(0x070b1a);scene.fog=new THREE.FogExp2(0x11152b,.014);sceneRef.current=scene;
    const camera=new THREE.PerspectiveCamera(52,mount.clientWidth/mount.clientHeight,.1,120);camera.position.set(0,15,24);cameraRef.current=camera;
    const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance"});renderer.setSize(mount.clientWidth,mount.clientHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.shadowMap.enabled=true;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.domElement.className="absolute inset-0 h-full w-full";mount.appendChild(renderer.domElement);rendererRef.current=renderer;
    const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,1.3,2);controls.enableDamping=true;controls.enablePan=true;controls.screenSpacePanning=false;controls.maxPolarAngle=Math.PI*.47;controls.minDistance=8;controls.maxDistance=36;
    controls.mouseButtons.LEFT=THREE.MOUSE.PAN;controls.mouseButtons.RIGHT=THREE.MOUSE.ROTATE;controls.touches.ONE=THREE.TOUCH.PAN;controls.touches.TWO=THREE.TOUCH.DOLLY_ROTATE;controlsRef.current=controls;
    scene.add(new THREE.HemisphereLight(0x8fb7ff,0x171226,1.7));
    const key=new THREE.DirectionalLight(0xc9dcff,2.2);key.position.set(-10,18,8);key.castShadow=true;scene.add(key);
    const ground=new THREE.Mesh(new THREE.CircleGeometry(31,96),new THREE.MeshStandardMaterial({color:0x12152a,roughness:.72,metalness:.18}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;ground.userData.ground=true;scene.add(ground);
    const grid=new THREE.GridHelper(56,28,0x22d3ee,0x312e81);grid.position.y=.025;(grid.material as THREE.Material).transparent=true;(grid.material as THREE.Material).opacity=.32;scene.add(grid);

    // Neon arcade clubhouse.
    addBox(scene,[18,6,6],[0,3,-24],0x17152c);addNeonBox(scene,[15,.18,.18],[0,5.55,-20.9],0x22d3ee,4);
    addNeonBox(scene,[.18,4.3,.18],[-8.1,3,-20.9],0xa855f7,3.4);addNeonBox(scene,[.18,4.3,.18],[8.1,3,-20.9],0xec4899,3.4);
    const clubSign=makeLabel("A.R.I.S.E ARCADE","#111827","#67e8f9");clubSign.position.set(0,7,-21);clubSign.scale.set(8.5,2.1,1);scene.add(clubSign);
    addBox(scene,[7,3.8,5],[-20,1.9,-17],0x17152c);addNeonBox(scene,[6.2,.16,.16],[-20,3.7,-14.4],0x8b5cf6,3);
    addBox(scene,[7,3.8,5],[20,1.9,-17],0x17152c);addNeonBox(scene,[6.2,.16,.16],[20,3.7,-14.4],0xf43f5e,3);

    // Center dance floor / meeting area.
    const dance=new THREE.Mesh(new THREE.CylinderGeometry(5.6,5.6,.16,64),new THREE.MeshStandardMaterial({color:0x14162d,metalness:.4,roughness:.45}));dance.position.set(0,.08,1);dance.receiveShadow=true;scene.add(dance);
    for(let i=0;i<3;i++){const ring=new THREE.Mesh(new THREE.TorusGeometry(2+i*1.35,.07,10,64),new THREE.MeshStandardMaterial({color:i===0?0x22d3ee:i===1?0xa855f7:0xec4899,emissive:i===0?0x22d3ee:i===1?0xa855f7:0xec4899,emissiveIntensity:3}));ring.rotation.x=Math.PI/2;ring.position.set(0,.2,1);scene.add(ring);}

    const discoBalls=[
      addDiscoBall(scene,-7.5,10,-2,1.15),
      addDiscoBall(scene,7.5,10,-2,1.15),
      addDiscoBall(scene,0,11,-10,1.4),
    ];
    const movingLights=[
      new THREE.PointLight(0x22d3ee,7,18,2),
      new THREE.PointLight(0xec4899,7,18,2),
      new THREE.PointLight(0xa855f7,7,18,2),
    ];
    movingLights.forEach((light,i)=>{light.position.set((i-1)*8,8,-3-i*3);scene.add(light);});

    // Lounge seating + social corners.
    addChair(scene,-19,6,.45,0x581c87);addChair(scene,-16.8,7.2,-.2,0x7e22ce);addLoungeTable(scene,-17.6,5.4);
    addChair(scene,18.5,6,-.55,0x9d174d);addChair(scene,16.5,7.3,.2,0xbe185d);addLoungeTable(scene,17.7,5.2);
    addChair(scene,-19,-1.5,1.2,0x312e81);addChair(scene,19,-1.5,-1.2,0x0f766e);

    for(const s of STATIONS){
      const color=stationColor(s.id);
      const light=new THREE.PointLight(color,11,14,2);light.position.set(s.x,5,s.z);scene.add(light);
      const pad=new THREE.Mesh(new THREE.CylinderGeometry(4.5,4.5,.28,48),new THREE.MeshStandardMaterial({color:0x0f172a,emissive:color,emissiveIntensity:.34,roughness:.42}));pad.position.set(s.x,.14,s.z);pad.receiveShadow=true;scene.add(pad);
      const ring=new THREE.Mesh(new THREE.TorusGeometry(4,.1,12,64),new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:3}));
      ring.rotation.x=Math.PI/2;ring.position.set(s.x,.34,s.z);scene.add(ring);
      const sign=makeLabel(s.name,"#020617","#ffffff");sign.position.set(s.x,5.15,s.z);sign.scale.set(5.5,1.35,1);scene.add(sign);
      addArcadeCabinet(scene,s);
    }

    // Decorative arcade cabinets create a fuller arcade without adding new game logic.
    const decoCabinets=[[-24,-8,0x06b6d4],[-24,-3,0x8b5cf6],[24,-8,0xec4899],[24,-3,0x14b8a6],[-18,-20,0xf59e0b],[18,-20,0x3b82f6]] as const;
    decoCabinets.forEach(([x,z,color])=>{
      const cab=addBox(scene,[2.6,3.4,1.65],[x,1.7,z],0x111827);
      addNeonBox(scene,[2.25,1.35,.08],[x,2.25,z+.86],color,2.6);
      addNeonBox(scene,[2.45,.12,.12],[x,3.25,z+.88],color,3.2);
    });

    createWorldExit(scene,0,22,0x22d3ee);
    const loader=new GLTFLoader();
    if(self.carId&&self.carId!=="car-none"){
      const car=createWorldModel(self.carId,loader,3.8);
      car.position.set(6,0,10);scene.add(car);selfCarRef.current=car;
      const parkSign=makeLabel("MY CAR","#0f172a","#67e8f9");parkSign.name="carSign";parkSign.position.set(0,3.2,0);parkSign.scale.set(3.2,.85,1);car.add(parkSign);
    }
    const loadAvatar=(uid:number,name:string,charId:string,petId:string|undefined|null,x:number,z:number,isSelf=false)=>{
      const root=new THREE.Group();root.position.set(x,0,z);root.userData.userId=uid;scene.add(root);
      const label=makeLabel(name);label.position.set(0,3.15,0);root.add(label);
      if(!isSelf){const hitArea=new THREE.Mesh(new THREE.CylinderGeometry(.95,.95,3.5,16),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));hitArea.position.y=1.75;root.add(hitArea);}
      const path=getAvatarCharacter(charId).modelPath;
      loader.load(path,gltf=>{
        if(disposed)return;
        const model=gltf.scene;const box=new THREE.Box3().setFromObject(model);const size=new THREE.Vector3();box.getSize(size);model.scale.setScalar(2.4/Math.max(.01,size.y));model.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(model);model.position.y=-b.min.y;model.traverse(o=>{if((o as THREE.Mesh).isMesh){(o as THREE.Mesh).castShadow=true;(o as THREE.Mesh).receiveShadow=true;}});const visual=new THREE.Group();visual.add(model);root.add(visual);root.userData.avatarVisual=visual;root.userData.avatarModel=model;visual.visible=!root.userData.driving;attachAvatarMotion(root,model,gltf.animations);
      });
      const pet=createPet(petId,loader,.95);if(pet){pet.position.set(.85,0,.55);root.add(pet);}
      if(isSelf)selfRootRef.current=root;else remoteRootsRef.current.set(uid,root);
      return root;
    };
    loadAvatar(self.userId,self.displayName,self.characterId,(self as any).petId,0,7,true);

    const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();
    const click=(e:PointerEvent)=>{
      const rect=renderer.domElement.getBoundingClientRect();pointer.x=((e.clientX-rect.left)/rect.width)*2-1;pointer.y=-((e.clientY-rect.top)/rect.height)*2+1;ray.setFromCamera(pointer,camera);
      const hits=ray.intersectObjects(scene.children,true);

      for(const hit of hits){
        let node:THREE.Object3D|null=hit.object;
        while(node){
          if(node.userData.worldExit){setLeavingWorld(true);return;}
          if(node.name==="clubPet"&&node.parent===selfRootRef.current){
            openPetCare();
            return;
          }
          const uid=Number(node.userData?.userId||0);
          if(uid){
            if(uid!==self.userId)void viewPlayer(uid);
            return;
          }
          // A cabinet tap selects the game. Only the Play button starts a match.
          const stationId=node.userData?.stationId as GameType|undefined;
          if(stationId){
            const station=STATIONS.find(s=>s.id===stationId);
            if(station){
              setShowReaders(false);
              setNearStation(station);
              return;
            }
          }
          node=node.parent;
        }
      }

      const hit=hits.find(h=>{let o:THREE.Object3D|null=h.object;while(o){if(o.userData.ground)return true;o=o.parent;}return false;});
      if(hit){setNearStation(null);targetRef.current.set(THREE.MathUtils.clamp(hit.point.x,-28,28),0,THREE.MathUtils.clamp(hit.point.z,-27,27));}
    };
    let pointerStart:{id:number;x:number;y:number}|null=null;
    const pointerDown=(e:PointerEvent)=>{pointerStart={id:e.pointerId,x:e.clientX,y:e.clientY};};
    const pointerUp=(e:PointerEvent)=>{if(!pointerStart||pointerStart.id!==e.pointerId)return;const moved=Math.hypot(e.clientX-pointerStart.x,e.clientY-pointerStart.y);pointerStart=null;if(moved<10)click(e);};
    const pointerCancel=()=>{pointerStart=null;};
    renderer.domElement.addEventListener("pointerdown",pointerDown);
    renderer.domElement.addEventListener("pointerup",pointerUp);
    renderer.domElement.addEventListener("pointercancel",pointerCancel);

    const down=(e:KeyboardEvent)=>keysRef.current.add(e.key.toLowerCase()),up=(e:KeyboardEvent)=>keysRef.current.delete(e.key.toLowerCase());
    window.addEventListener("keydown",down);window.addEventListener("keyup",up);

    const clock=new THREE.Clock();
    let raf=0;
    const loop=()=>{
      if(disposed)return;const dt=Math.min(.04,clock.getDelta());const root=selfRootRef.current;
      if(root){
        (root.userData.mixer as THREE.AnimationMixer|undefined)?.update(dt);
        const transition=carTransitionRef.current;
        if(transition){
          const elapsed=(performance.now()-transition.started)/1000;
          const visual=root.userData.avatarVisual as THREE.Group|undefined;
          if(transition.kind==="enter"){
            const approach=Math.min(1,elapsed/1.1);
            const smooth=approach*approach*(3-2*approach);
            root.position.lerpVectors(transition.from,transition.door,smooth);
            root.rotation.y=Math.atan2(transition.car.x-root.position.x,transition.car.z-root.position.z);
            if(visual&&elapsed>1.1){const climb=Math.min(1,(elapsed-1.1)/.7);
              visual.position.set(0,climb*.45,climb*1.8);visual.rotation.z=-climb*.25;visual.scale.setScalar(1-climb*.35);
            }
            if(elapsed>=1.8){root.position.copy(transition.car);targetRef.current.copy(root.position);
              if(visual){visual.visible=false;visual.position.set(0,0,0);visual.rotation.z=0;visual.scale.setScalar(1);}
              const pet=root.getObjectByName("clubPet");if(pet)pet.visible=false;
              (root.userData.travelAction as THREE.AnimationAction|undefined)?.stop();(root.userData.idle as THREE.AnimationAction|undefined)?.reset().play();
              root.userData.driving=true;drivingRef.current=true;setDriving(true);setCarTransition(null);carTransitionRef.current=null;
              const center=new THREE.Vector3(root.position.x,1.3,root.position.z);camera.position.add(center.clone().sub(controls.target));controls.target.copy(center);
              setNotice("You're in! Use WASD, arrows, or tap the floor to drive.");
              void fetch(API_BASE+"/api/club-arise/presence",{method:"POST",headers,body:JSON.stringify({x:root.position.x,z:root.position.z,facing:root.rotation.y,driving:true})});
            }
          }else{
            const progress=Math.min(1,elapsed/1.1);
            const smooth=progress*progress*(3-2*progress);
            if(visual){const local=transition.door.clone().sub(transition.car).applyAxisAngle(new THREE.Vector3(0,1,0),-root.rotation.y);
              visual.position.set(local.x*smooth,.45*(1-smooth),local.z*smooth);visual.scale.setScalar(.65+.35*smooth);visual.rotation.z=(1-smooth)*.22;
            }
            if(progress>=1){root.position.copy(transition.door);targetRef.current.copy(root.position);
              if(visual){visual.position.set(0,0,0);visual.rotation.z=0;visual.scale.setScalar(1);}
              const pet=root.getObjectByName("clubPet");if(pet)pet.visible=true;
              root.userData.driving=false;drivingRef.current=false;setDriving(false);setCarTransition(null);carTransitionRef.current=null;
              const sign=selfCarRef.current?.getObjectByName("carSign");if(sign)sign.visible=true;
              setNotice("You're out of the car. It is parked beside you.");
              void fetch(API_BASE+"/api/club-arise/presence",{method:"POST",headers,body:JSON.stringify({x:root.position.x,z:root.position.z,facing:root.rotation.y,driving:false})});
            }
          }
        }else{
          let dx=0,dz=0;const k=keysRef.current;if(k.has("w")||k.has("arrowup"))dz-=1;if(k.has("s")||k.has("arrowdown"))dz+=1;if(k.has("a")||k.has("arrowleft"))dx-=1;if(k.has("d")||k.has("arrowright"))dx+=1;
          const dest=targetRef.current.clone();
          if(dx||dz){const v=new THREE.Vector3(dx,0,dz).normalize().multiplyScalar((drivingRef.current?10:5)*dt);root.position.add(v);targetRef.current.copy(root.position);root.rotation.y=Math.atan2(v.x,v.z);}
          else{const diff=dest.sub(root.position);diff.y=0;if(diff.length()>.18){diff.normalize();root.position.addScaledVector(diff,(drivingRef.current?8:4.2)*dt);root.rotation.y=Math.atan2(diff.x,diff.z);}}
        }
        root.position.x=THREE.MathUtils.clamp(root.position.x,-28,28);root.position.z=THREE.MathUtils.clamp(root.position.z,-27,27);
        if(!carTransitionRef.current&&Math.hypot(root.position.x,root.position.z-22)<1.7){setLeavingWorld(true);return;}
        if(drivingRef.current&&selfCarRef.current&&!carTransitionRef.current){selfCarRef.current.position.set(root.position.x,0,root.position.z);selfCarRef.current.rotation.y=root.rotation.y;
          const desired=new THREE.Vector3(root.position.x,1.3,root.position.z);const shift=desired.sub(controls.target).multiplyScalar(.12);camera.position.add(shift);controls.target.add(shift);
        }
        const pet=root.getObjectByName("clubPet");if(pet&&!drivingRef.current){const personality=PET_PERSONALITIES[String(pet.userData.petId)];const t=performance.now()*.001;pet.position.y=personality?.motion==="bounce"?Math.abs(Math.sin(t*3))*.16:Math.sin(t*2)*.045;pet.rotation.z=personality?.motion==="sway"?Math.sin(t*2)*.12:0;pet.rotation.y=personality?.motion==="spin"?Math.sin(t*.7)*.35:0;}
      }
      const nowMs=performance.now();
      const activeEmote=selfEmoteRef.current;
      if(root&&activeEmote){
        const elapsed=(nowMs-activeEmote.started)/1000;
        const duration=activeEmote.name==="dance"?3.2:activeEmote.name==="silly"?2.4:activeEmote.name==="flip"?1.5:1.35;
        const p=Math.min(1,elapsed/duration);
        root.position.y=activeEmote.name==="jump"?Math.sin(Math.PI*p)*2:activeEmote.name==="flip"?Math.sin(Math.PI*p)*1.1:activeEmote.name==="dance"?Math.abs(Math.sin(elapsed*9))*.25:0;
        if(activeEmote.name==="flip")root.rotation.z=Math.PI*2*p;
        else if(activeEmote.name==="dance"){root.rotation.z=Math.sin(elapsed*9)*.28;root.rotation.y+=dt*3.5;}
        else if(activeEmote.name==="silly"){root.rotation.z=Math.sin(elapsed*14)*.4;root.scale.y=1+Math.sin(elapsed*12)*.17;}
        if(p>=1){root.position.y=0;root.rotation.z=0;root.scale.set(1,1,1);selfEmoteRef.current=null;setAvatarGesture(root,null);}
      }
      for(const remote of playersRef.current){
        if(remote.user_id===self.userId)continue;
        const rr=remoteRootsRef.current.get(remote.user_id);if(!rr)continue;
        (rr.userData.mixer as THREE.AnimationMixer|undefined)?.update(dt);
        if(!remote.emote||!remote.emote_at){if(rr.userData.gesture)setAvatarGesture(rr,null);continue;}
        if(rr.userData.lastEmoteAt!==remote.emote_at){rr.userData.lastEmoteAt=remote.emote_at;setAvatarGesture(rr,remote.emote);}
        const elapsed=(Date.now()-new Date(remote.emote_at).getTime())/1000;
        if(elapsed<0||elapsed>3.4){rr.position.y=0;rr.rotation.z=0;rr.scale.set(1,1,1);if(rr.userData.gesture)setAvatarGesture(rr,null);continue;}
        const dur=remote.emote==="dance"?3.2:remote.emote==="silly"?2.4:remote.emote==="flip"?1.5:1.35;
        const p=Math.min(1,elapsed/dur);
        rr.position.y=remote.emote==="jump"?Math.sin(Math.PI*p)*2:remote.emote==="flip"?Math.sin(Math.PI*p)*1.1:remote.emote==="dance"?Math.abs(Math.sin(elapsed*9))*.25:0;
        if(remote.emote==="flip")rr.rotation.z=Math.PI*2*p;
        else if(remote.emote==="dance")rr.rotation.z=Math.sin(elapsed*9)*.28;
        else if(remote.emote==="silly"){rr.rotation.z=Math.sin(elapsed*14)*.4;rr.scale.y=1+Math.sin(elapsed*12)*.17;}
      }

      const t=performance.now()*.001;
      discoBalls.forEach((ball,i)=>{ball.rotation.y+=dt*(.35+i*.08);ball.rotation.x+=dt*.08;});
      movingLights.forEach((light,i)=>{
        const a=t*.7+i*Math.PI*2/3;
        light.position.x=Math.cos(a)*12;
        light.position.z=-2+Math.sin(a)*10;
        light.position.y=7.5+Math.sin(a*1.7)*1.5;
      });
      remoteRootsRef.current.forEach(remote=>{
        const pet=remote.getObjectByName("clubPet");if(pet&&pet.visible){const personality=PET_PERSONALITIES[String(pet.userData.petId)];const t=performance.now()*.001;pet.position.y=personality?.motion==="bounce"?Math.abs(Math.sin(t*3))*.16:Math.sin(t*2)*.045;pet.rotation.z=personality?.motion==="sway"?Math.sin(t*2)*.12:0;pet.rotation.y=personality?.motion==="spin"?Math.sin(t*.7)*.35:0;}
      });
      controls.update();renderer.render(scene,camera);raf=requestAnimationFrame(loop);
    };loop();
    setReady(true);

    const resize=()=>{camera.aspect=mount.clientWidth/mount.clientHeight;camera.updateProjectionMatrix();renderer.setSize(mount.clientWidth,mount.clientHeight);};window.addEventListener("resize",resize);
    return()=>{disposed=true;selfCarRef.current=null;drivingRef.current=false;carTransitionRef.current=null;cancelAnimationFrame(raf);window.removeEventListener("resize",resize);window.removeEventListener("keydown",down);window.removeEventListener("keyup",up);renderer.domElement.removeEventListener("pointerdown",pointerDown);renderer.domElement.removeEventListener("pointerup",pointerUp);renderer.domElement.removeEventListener("pointercancel",pointerCancel);controls.dispose();renderer.dispose();remoteRootsRef.current.clear();if(renderer.domElement.parentElement===mount)mount.removeChild(renderer.domElement);};
  },[self,token]);

  useEffect(()=>{
    const controls=controlsRef.current;if(!controls)return;
    controls.mouseButtons.LEFT=cameraMode==="pan"?THREE.MOUSE.PAN:THREE.MOUSE.ROTATE;
    controls.touches.ONE=cameraMode==="pan"?THREE.TOUCH.PAN:THREE.TOUCH.ROTATE;
    controls.touches.TWO=cameraMode==="pan"?THREE.TOUCH.DOLLY_ROTATE:THREE.TOUCH.DOLLY_PAN;
  },[cameraMode,ready]);

  useEffect(()=>{
    if(!ready||!token||!self)return;
    const sync=async()=>{
      const root=selfRootRef.current;if(!root)return;
      try{
        const now=Date.now();if(now-lastSyncRef.current<500)return;lastSyncRef.current=now;
        const r=await fetch(API_BASE+"/api/club-arise/presence",{method:"POST",headers,body:JSON.stringify({x:root.position.x,z:root.position.z,facing:root.rotation.y,driving:drivingRef.current})});const d=await r.json();if(r.ok)setPlayers(d.players||[]);
      }catch{}
    };
    const id=window.setInterval(sync,650);return()=>clearInterval(id);
  },[ready,token,self,headers]);

  useEffect(()=>{
    if(!sceneRef.current||!self)return;const scene=sceneRef.current,loader=new GLTFLoader();
    const active=new Set<number>();
    for(const p of players){if(p.user_id===self.userId)continue;active.add(p.user_id);let root=remoteRootsRef.current.get(p.user_id);
      if(!root){root=new THREE.Group();root.position.set(p.x,0,p.z);root.userData.userId=p.user_id;scene.add(root);const label=makeLabel(p.display_name);label.position.set(0,3.15,0);root.add(label);const hitArea=new THREE.Mesh(new THREE.CylinderGeometry(.95,.95,3.5,16),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));hitArea.position.y=1.75;root.add(hitArea);loader.load(getAvatarCharacter(p.character_id).modelPath,g=>{const model=g.scene;const box=new THREE.Box3().setFromObject(model),size=new THREE.Vector3();box.getSize(size);model.scale.setScalar(2.4/Math.max(.01,size.y));model.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(model);model.position.y=-b.min.y;root!.add(model);root!.userData.avatarModel=model;model.visible=!root!.userData.driving;attachAvatarMotion(root!,model,g.animations);if(p.emote&&p.emote_at&&Date.now()-new Date(p.emote_at).getTime()<3200)setAvatarGesture(root!,p.emote);});remoteRootsRef.current.set(p.user_id,root);}
      if(root.userData.petId!==p.pet_id){const old=root.getObjectByName("clubPet");if(old)root.remove(old);const pet=createPet(p.pet_id,loader,.95);if(pet){pet.position.set(.85,0,.55);root.add(pet);}root.userData.petId=p.pet_id;}
      root.userData.driving=!!p.driving;
      const avatar=root.userData.avatarModel as THREE.Object3D|undefined;if(avatar)avatar.visible=!p.driving;
      const pet=root.getObjectByName("clubPet");if(pet)pet.visible=!p.driving;
      const oldCar=root.getObjectByName("readerCar");
      if(oldCar&&(!p.driving||oldCar.userData.carId!==p.car_id))root.remove(oldCar);
      if(p.driving&&p.car_id&&p.car_id!=="car-none"&&!root.getObjectByName("readerCar")){
        const car=createWorldModel(p.car_id,loader,3.8);car.name="readerCar";car.userData.carId=p.car_id;root.add(car);
      }
      root.position.lerp(new THREE.Vector3(p.x,0,p.z),.35);root.rotation.y=THREE.MathUtils.lerp(root.rotation.y,p.facing,.35);
      const phraseFresh=p.phrase&&p.phrase_at&&Date.now()-new Date(p.phrase_at).getTime()<4500;const old=root.getObjectByName("phrase");if(old)root.remove(old);
      if(phraseFresh){const bubble=makeLabel(p.phrase!,"#ffffff","#111827");bubble.name="phrase";bubble.position.set(0,4.35,0);root.add(bubble);}
    }
    remoteRootsRef.current.forEach((root,uid)=>{if(!active.has(uid)){scene.remove(root);remoteRootsRef.current.delete(uid);}});
  },[players,self]);

  const sendPhrase=async(phrase:string)=>{
    const root=selfRootRef.current;if(!root)return;
    await fetch(API_BASE+"/api/club-arise/presence",{method:"POST",headers,body:JSON.stringify({x:root.position.x,z:root.position.z,facing:root.rotation.y,phrase,driving:drivingRef.current})});
    setNotice(phrase);
  };

  const doEmote=async(name:"dance"|"jump"|"flip"|"silly")=>{
    const root=selfRootRef.current;if(!root||drivingRef.current)return;
    selfEmoteRef.current={name,started:performance.now()};
    setAvatarGesture(root,name);
    playFunnyEmoteMusic(name);
    try{
      const r=await fetch(API_BASE+"/api/club-arise/presence",{method:"POST",headers,body:JSON.stringify({x:root.position.x,z:root.position.z,facing:root.rotation.y,emote:name,driving:false})});
      const d=await r.json();if(r.ok)setPlayers(d.players||[]);
    }catch{}
  };

  const joinGame=async(station:Station,computer=false)=>{
    setNotice(computer?"Starting a game against the computer…":"Finding another player…");
    const r=await fetch(API_BASE+"/api/club-arise/matches/join",{method:"POST",headers,body:JSON.stringify({gameType:station.id,computer})});const d=await r.json();
    if(!r.ok){setNotice(d.message||"Could not join game.");return;}setMatch(d);setGameOpen(true);
  };

  useEffect(()=>{
    if(!match||!gameOpen)return;
    const id=window.setInterval(async()=>{
      const r=await fetch(API_BASE+"/api/club-arise/matches/"+match.id,{headers:{Authorization:"Bearer "+token},cache:"no-store"});
      if(!r.ok)return;
      const next=await r.json();
      if(next.status==="cancelled"){
        setGameOpen(false);setMatch(null);setNotice("That game ended. Choose a new opponent.");
        return;
      }
      setMatch(next);
    },700);
    return()=>clearInterval(id);
  },[match?.id,gameOpen,token]);

  const gameAction=async(body:any)=>{
    if(!match)return;const r=await fetch(API_BASE+"/api/club-arise/matches/"+match.id+"/action",{method:"POST",headers,body:JSON.stringify(body)});const d=await r.json();if(r.ok)setMatch(d);else setNotice(d.message||"Try again.");
  };

  const quitGame=async()=>{
    const current=match;
    setGameOpen(false);setMatch(null);setNearStation(null);
    if(!current||!["waiting","active"].includes(current.status))return;
    try{
      await fetch(API_BASE+"/api/club-arise/matches/"+current.id+"/leave",{
        method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:"{}",keepalive:true,
      });
    }catch{}
    setNotice("Game ended. Pick a game and opponent to start fresh.");
  };

  useEffect(()=>{
    if(!match||!gameOpen||!["waiting","active"].includes(match.status))return;
    const leave=()=>{void fetch(API_BASE+"/api/club-arise/matches/"+match.id+"/leave",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:"{}",keepalive:true}).catch(()=>{});};
    window.addEventListener("pagehide",leave);
    return()=>window.removeEventListener("pagehide",leave);
  },[match?.id,match?.status,gameOpen,token]);

  const myIndex=match&&self?(match.player1_id===self.userId?1:match.player2_id===self.userId?2:0):0;
  const yourTurn=!!match&&match.status==="active"&&Number(match.state?.turn)===myIndex;
  const opponent=match?.state?.computer?"Computer":match?.players?.find(p=>p.user_id!==self?.userId)?.display_name||"another reader";
  const onlineReaders=players.filter(p=>p.user_id!==self?.userId);
  const move=(key:"w"|"a"|"s"|"d",pressed:boolean)=>{if(pressed)keysRef.current.add(key);else keysRef.current.delete(key);};

  return <main className="club-world-root relative h-[100dvh] overflow-hidden bg-slate-950 text-white">
    <div ref={mountRef} className="absolute inset-0"/>
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center gap-2 bg-gradient-to-b from-black/80 via-black/45 to-transparent px-2 py-2 sm:p-3">
      <button onClick={()=>setLeavingWorld(true)} className="pointer-events-auto grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-black/70 font-black backdrop-blur sm:flex sm:min-h-12 sm:w-auto sm:gap-2 sm:px-4" aria-label="Exit to worlds"><ArrowLeft className="h-5 w-5"/><span className="hidden sm:inline">Exit to worlds</span></button>
      <div className="min-w-0 flex-1 text-center sm:text-left"><h1 className="truncate text-base font-black sm:text-xl">A.R.I.S.E Arcade</h1><p className="hidden text-xs font-bold text-white/70 sm:block">Learn · play · meet readers safely</p></div>
      <button type="button" onClick={()=>{setShowReaders(value=>!value);setSelectedPlayer(null);setSelectedPlayerId(null);setShowMobileChat(false);setShowMobileCamera(false);}} className="pointer-events-auto flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-2xl bg-black/70 px-3 font-black backdrop-blur sm:min-h-11 sm:gap-2 sm:py-2" aria-expanded={showReaders} aria-label="Show readers online"><Users className="h-4 w-4"/><span>{onlineReaders.length}</span><span className="hidden sm:inline">readers</span></button>
    </header>

    <button type="button" onClick={()=>navigate("/club-arise/theater")} className="absolute right-2 top-16 z-30 flex min-h-10 items-center gap-2 rounded-xl border border-fuchsia-300/25 bg-slate-950/90 px-3 text-xs font-black shadow-lg backdrop-blur hover:bg-fuchsia-500/20 sm:right-3 sm:top-20 sm:min-h-11 sm:text-sm">
      <Film className="h-4 w-4 text-fuchsia-300"/> Movie Theater
    </button>

    {self?.carId&&self.carId!=="car-none"&&<div className="absolute right-3 top-36 z-30 flex max-w-44 flex-col gap-2 rounded-2xl border border-cyan-300/25 bg-slate-950/90 p-2 backdrop-blur">
      <button type="button" onClick={toggleDriving} disabled={!!carTransition} className="min-h-12 rounded-xl bg-cyan-300 px-3 font-black text-slate-950 disabled:opacity-50">{carTransition==="enter"?"Getting in…":carTransition==="exit"?"Getting out…":driving?"Get out of car":"Get in and drive"}</button>
      <p className="text-center text-xs text-white/65">{carTransition?"Watch your character move":driving?"Drive with WASD, arrows, or tap":"Parked by the dance floor"}</p>
    </div>}

    {!showReaders&&!selectedPlayer&&!playerLoading&&!nearStation&&showMobileChat&&<div className="absolute left-3 top-20 z-40 w-[min(310px,calc(100%-1.5rem))] rounded-2xl bg-black/88 p-3 shadow-2xl backdrop-blur">
      <div className="mb-2 flex items-center justify-between gap-2 text-xs font-black uppercase tracking-wider text-white/60"><span className="flex items-center gap-2"><MessageCircle className="h-4 w-4"/> Safe chat</span><button type="button" onClick={()=>setShowMobileChat(false)} className="grid h-8 w-8 place-items-center rounded-lg bg-white/10" aria-label="Close safe chat"><X className="h-4 w-4"/></button></div>
      <div className="flex flex-wrap gap-2">{phrases.slice(0,10).map(p=><button key={p} onClick={()=>{void sendPhrase(p);setShowMobileChat(false);}} className="min-h-10 rounded-xl bg-white/10 px-3 text-xs font-black hover:bg-white/20">{p}</button>)}</div>
    </div>}

    {showReaders&&!gameOpen&&<aside className="absolute right-3 top-20 z-40 max-h-[55dvh] w-[min(340px,calc(100%-1.5rem))] overflow-y-auto rounded-2xl border border-cyan-300/25 bg-slate-950/95 p-3 shadow-2xl backdrop-blur">
      <div className="mb-3 flex items-center justify-between"><h2 className="font-black">Readers online</h2><button type="button" onClick={()=>setShowReaders(false)} className="grid h-10 w-10 place-items-center rounded-xl bg-white/10" aria-label="Close readers list"><X className="h-4 w-4"/></button></div>
      {onlineReaders.length===0?<p className="text-sm text-white/65">No other readers are here yet.</p>:<div className="space-y-2">{onlineReaders.map(player=><div key={player.user_id} className="flex items-center gap-2 rounded-xl bg-white/10 p-2">
        <button type="button" onClick={()=>void viewPlayer(player.user_id)} className="min-h-11 min-w-0 flex-1 truncate rounded-lg px-2 text-left font-bold hover:bg-white/10" aria-label={"View "+player.display_name+"'s stats"}>{player.display_name}<span className="block text-xs font-medium text-cyan-200">View stats</span></button>
        <button type="button" onClick={()=>walkToPlayer(player.user_id)} className="min-h-11 shrink-0 rounded-lg bg-cyan-300 px-3 text-sm font-black text-slate-950">Walk over</button>
      </div>)}</div>}
    </aside>}

    <div className="pointer-events-none absolute left-1/2 top-14 z-20 max-w-[62vw] -translate-x-1/2 truncate rounded-full bg-black/60 px-3 py-1.5 text-[11px] font-black backdrop-blur sm:top-20 sm:max-w-none sm:rounded-2xl sm:px-4 sm:py-2 sm:text-sm">{notice}</div>

    <MobileJoystick onMove={move} className="bottom-24 left-3" label="Arcade movement controls"/>
    <div className="absolute bottom-3 right-3 z-40 flex flex-col gap-1.5 rounded-2xl border border-white/15 bg-slate-950/88 p-1.5 shadow-2xl backdrop-blur-xl">
      <button type="button" onClick={()=>{setShowMobileChat(value=>!value);setShowMobileCamera(false);setShowArcade(false);setShowEmotes(false);setShowReaders(false);}} className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 hover:bg-white/20" aria-label="Safe chat"><MessageCircle className="h-4 w-4"/></button>
      <button type="button" onClick={()=>{setShowMobileCamera(value=>!value);setShowMobileChat(false);setShowArcade(false);setShowEmotes(false);setShowReaders(false);}} className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-xs font-black hover:bg-white/20" aria-label="Camera controls">⌖</button>
      <button type="button" onClick={()=>{setShowEmotes(value=>!value);setShowArcade(false);setShowMobileChat(false);setShowMobileCamera(false);}} className="grid h-10 w-10 place-items-center rounded-xl bg-fuchsia-500/20 text-lg hover:bg-fuchsia-500/35" aria-label="Moves">💃</button>
      <button type="button" onClick={()=>{setShowArcade(value=>!value);setShowEmotes(false);setShowMobileChat(false);setShowMobileCamera(false);}} className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-500/20 hover:bg-cyan-500/35" aria-label="Arcade games"><Gamepad2 className="h-4 w-4"/></button>
    </div>

    <div className={"absolute left-3 top-20 z-40 flex flex-col gap-2 rounded-2xl border border-white/15 bg-slate-950/95 p-2 shadow-xl backdrop-blur "+(showMobileCamera?"flex":"hidden")} aria-label="Camera controls">
      <div className="flex items-center justify-between gap-3 px-1"><span className="text-[10px] font-black uppercase tracking-widest text-white/50">Camera</span><button type="button" onClick={()=>setShowMobileCamera(false)} className="grid h-7 w-7 place-items-center rounded-lg bg-white/10" aria-label="Close camera controls"><X className="h-3.5 w-3.5"/></button></div><button type="button" onClick={()=>setCameraMode("pan")} aria-pressed={cameraMode==="pan"} className={"min-h-10 rounded-xl px-3 text-xs font-black "+(cameraMode==="pan"?"bg-cyan-300 text-slate-950":"bg-white/10 text-white")}>Move</button>
      <button type="button" onClick={()=>setCameraMode("rotate")} aria-pressed={cameraMode==="rotate"} className={"min-h-10 rounded-xl px-3 text-xs font-black "+(cameraMode==="rotate"?"bg-cyan-300 text-slate-950":"bg-white/10 text-white")}>Rotate</button>
      <button type="button" onClick={()=>{centerOnMe();setShowMobileCamera(false);}} className="min-h-10 rounded-xl bg-white/10 px-3 text-xs font-black text-white">Center</button>
      <p className="max-w-32 px-1 text-center text-[10px] text-white/60">{cameraMode==="pan"?"Drag to slide the view":"Drag to turn the view"}</p>
    </div>
    {access&&!access.allowed&&<div className="absolute left-1/2 top-32 z-40 w-[min(430px,90vw)] -translate-x-1/2 rounded-2xl border border-amber-300/30 bg-slate-950/95 p-4 text-center shadow-2xl">
      <p className="font-black text-amber-300">{access.locked?"Arcade games are locked by your teacher.":access.dailyRemaining===0?"You reached today's arcade game limit.":"Pass another book quiz to unlock more Arcade games."}</p>
      <p className="mt-1 text-xs font-bold text-white/55">{access.gamesPerPassedQuiz>0?access.automaticRemaining+" automatic game plays remaining":access.dailyLimit!==null?access.dailyRemaining+" games remaining today":"You can still explore, chat safely, and use emotes."}</p>
    </div>}

    {showEmotes&&<div className="absolute bottom-3 left-1/2 z-40 flex -translate-x-1/2 gap-1 rounded-2xl border border-fuchsia-300/30 bg-slate-950/94 p-1.5 shadow-xl backdrop-blur-xl whitespace-nowrap">
      {([
        ["dance","💃","Dance"],["jump","⬆️","Jump"],["flip","🤸","Flip"],["silly","🌀","Silly"]
      ] as const).map(([id,icon,label])=><button key={id} type="button" onClick={()=>void doEmote(id)} className="min-h-10 rounded-xl bg-fuchsia-500/25 px-2 text-xs font-black hover:bg-fuchsia-500/45 sm:min-h-12 sm:px-4 sm:text-sm"><span className="text-base sm:mr-1 sm:text-lg">{icon}</span><span className="hidden sm:inline">{label}</span></button>)}
    </div>}

    {showArcade&&<div className="absolute bottom-3 left-1/2 z-40 w-[min(760px,calc(100%-5.5rem))] -translate-x-1/2 rounded-2xl border border-cyan-300/20 bg-slate-950/94 p-2 shadow-2xl backdrop-blur-xl">
      <div className="mb-1.5 flex items-center justify-between px-1">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[.18em] text-cyan-300 sm:text-[10px] sm:tracking-[.22em]">Arcade games</p>
          <p className="hidden text-xs font-bold text-white/55 sm:block">Choose a game, then press Play.</p>
        </div>
        <div className="flex items-center gap-1"><Zap className="h-4 w-4 text-amber-300"/><button type="button" onClick={()=>setShowArcade(false)} className="grid h-7 w-7 place-items-center rounded-lg bg-white/10" aria-label="Close arcade menu"><X className="h-3.5 w-3.5"/></button></div>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 sm:grid sm:grid-cols-4 sm:gap-2 sm:pb-1">
        {STATIONS.map(station=>(
          <button
            key={station.id}
            type="button"
            onClick={()=>{setShowReaders(false);setShowMobileChat(false);setShowMobileCamera(false);setShowArcade(false);setNearStation(station);}}
            className={"min-h-11 min-w-[112px] rounded-xl border px-2.5 py-1.5 text-left transition hover:-translate-y-0.5 sm:min-h-16 sm:min-w-0 sm:rounded-2xl sm:px-3 sm:py-2 "+
              (station.id==="four"
                ?"border-blue-300/30 bg-blue-500/20 hover:bg-blue-500/30"
                :station.id==="word_tiles"
                  ?"border-violet-300/30 bg-violet-500/20 hover:bg-violet-500/30"
                  :"border-emerald-300/30 bg-emerald-500/20 hover:bg-emerald-500/30")}
          >
            <span className="block text-xs font-black leading-tight sm:text-sm">{station.name}</span>
            <span className="mt-1 hidden text-[10px] font-bold text-white/55 sm:block">{station.subtitle}</span>
          </button>
        ))}
      </div>
    </div>}

    {(selectedPlayer||playerLoading)&&!gameOpen&&(
      <aside className="absolute right-3 top-20 z-40 max-h-[65dvh] w-[min(330px,calc(100%-1.5rem))] overflow-y-auto rounded-[1.8rem] border border-white/15 bg-slate-950/95 p-4 shadow-2xl backdrop-blur-xl">
        <div className="flex items-start gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-cyan-400/15 text-cyan-300">
            <UserRound className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-white/45">Player profile</p>
            <h2 className="truncate text-xl font-black">{playerLoading?"Loading…":selectedPlayer?.displayName}</h2>
          </div>
          <button type="button" onClick={()=>{setSelectedPlayer(null);setSelectedPlayerId(null);}} className="grid h-10 w-10 place-items-center rounded-xl bg-white/10" aria-label="Close player stats"><X className="h-4 w-4"/></button>
        </div>
        {selectedPlayer&&(
          <>
            {selectedPlayerId!==null&&<button type="button" onClick={()=>walkToPlayer(selectedPlayerId)} className="mt-3 min-h-12 w-full rounded-xl bg-cyan-300 px-4 font-black text-slate-950">Walk over to {selectedPlayer.displayName}</button>}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-amber-400/10 p-3 ring-1 ring-amber-300/20">
                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-amber-200"><Trophy className="h-3.5 w-3.5"/> A.R.I.S.E. points</div>
                <div className="mt-1 text-2xl font-black text-amber-300">{selectedPlayer.leaderboardPoints.toLocaleString()}</div>
              </div>
              <div className="rounded-2xl bg-cyan-400/10 p-3 ring-1 ring-cyan-300/20">
                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-cyan-200"><Gamepad2 className="h-3.5 w-3.5"/> Arcade score</div>
                <div className="mt-1 text-2xl font-black text-cyan-300">{selectedPlayer.club.score}</div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-white/5 p-2"><div className="text-lg font-black">{selectedPlayer.club.played}</div><div className="text-[10px] font-bold text-white/45">GAMES</div></div>
              <div className="rounded-xl bg-white/5 p-2"><div className="text-lg font-black text-emerald-300">{selectedPlayer.club.wins}</div><div className="text-[10px] font-bold text-white/45">WINS</div></div>
              <div className="rounded-xl bg-white/5 p-2"><div className="text-lg font-black">{selectedPlayer.quizzesTaken}</div><div className="text-[10px] font-bold text-white/45">QUIZZES</div></div>
            </div>
            <div className="mt-3 space-y-2">
              {STATIONS.map(station=>{
                const stats=selectedPlayer.club.byGame?.[station.id]||{played:0,wins:0};
                return <div key={station.id} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-xs font-bold">
                  <span>{station.name}</span>
                  <span className="text-white/55">{stats.wins}W · {stats.played} played</span>
                </div>;
              })}
            </div>
          </>
        )}
      </aside>
    )}

    {nearStation&&!gameOpen&&<div className="absolute left-1/2 top-32 z-40 w-[min(420px,90vw)] -translate-x-1/2 rounded-3xl border border-cyan-300/25 bg-slate-950 p-5 text-white shadow-2xl">
      <div className="flex items-start gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-300/15"><Gamepad2 className="h-6 w-6 text-cyan-300"/></div><div className="flex-1"><h2 className="text-xl font-black">{nearStation.name}</h2><p className="text-sm font-semibold text-white/65">{nearStation.subtitle}</p><p className="mt-2 text-sm text-white/70">Ready to play this game?</p></div><button type="button" onClick={()=>setNearStation(null)} className="grid h-10 w-10 place-items-center rounded-xl bg-white/10" aria-label="Close game choice"><X className="h-4 w-4"/></button></div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={()=>{void joinGame(nearStation,false);setNearStation(null);}} disabled={access?.allowed===false} className="min-h-12 rounded-2xl bg-cyan-300 px-4 font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">👥 Play another reader</button>
        <button type="button" onClick={()=>{void joinGame(nearStation,true);setNearStation(null);}} disabled={access?.allowed===false} className="min-h-12 rounded-2xl bg-violet-500 px-4 font-black text-white disabled:cursor-not-allowed disabled:opacity-40">🤖 Play computer</button>
      </div>
      {access?.allowed===false&&<p className="mt-2 text-sm text-amber-300">Arcade games are currently unavailable.</p>}
    </div>}

    {gameOpen&&match&&<div className="absolute inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <section className="max-h-[92dvh] w-[min(760px,96vw)] overflow-auto rounded-[2rem] bg-white p-5 text-slate-950 shadow-2xl">
        <div className="flex items-start gap-3"><div className="flex-1"><p className="text-xs font-black uppercase tracking-wider text-slate-400">{match.state?.computer?"A.R.I.S.E Arcade · vs Computer":"A.R.I.S.E Arcade multiplayer"}</p><h2 className="text-2xl font-black">{STATIONS.find(s=>s.id===match.game_type)?.name}</h2><p className="mt-1 text-sm font-semibold text-slate-500">{match.status==="waiting"?"Waiting for another reader…":match.status==="active"?(yourTurn?"Your turn!":"Waiting for "+opponent+"…"):"Game complete"}</p></div><button onClick={()=>void quitGame()} className="grid h-11 w-11 place-items-center rounded-xl bg-slate-100" aria-label="Quit game"><X/></button></div>

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

        {["math_duel","synonym_sprint","pattern_power","sentence_fix","fact_dash"].includes(match.game_type)&&<div className="mt-5">
          <div className="flex justify-between rounded-2xl bg-cyan-50 p-4 font-black"><span>You: {match.state?.scores?.[myIndex-1]||0}</span><span>{opponent}: {match.state?.scores?.[myIndex===1?1:0]||0}</span></div>
          <div className="mt-4 rounded-2xl bg-slate-100 p-5 text-center">
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Round {(match.state?.round||0)+1}</p>
            <h3 className="mt-2 text-xl font-black">{match.state?.questions?.[match.state?.round]?.q||"Round complete"}</h3>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">{(match.state?.questions?.[match.state?.round]?.options||[]).map((choice:string)=><button key={choice} disabled={!yourTurn||match.status!=="active"} onClick={()=>void gameAction({choice})} className="min-h-20 rounded-2xl bg-slate-950 px-3 text-base font-black text-white disabled:opacity-40">{choice}</button>)}</div>
        </div>}

        {match.status==="finished"&&<div className="mt-5 rounded-2xl bg-amber-50 p-5 text-center"><h3 className="text-2xl font-black">{match.state?.computer?(Number(match.state?.winner)===1?"You won!":Number(match.state?.winner)===2?"Computer won — try again!":"Tie game!"):(match.winner_id===self?.userId?"You won!":match.winner_id?"Good game!":"Tie game!")}</h3><button onClick={()=>{setGameOpen(false);setMatch(null);}} className="mt-3 min-h-12 rounded-2xl bg-slate-950 px-5 font-black text-white">Back to Arcade</button></div>}
      </section>
    </div>}

    <div className="absolute bottom-28 right-3 z-20 hidden rounded-xl bg-black/50 px-3 py-2 text-xs font-bold text-white/70 sm:block">Click a player for stats · click floor to walk · WASD / arrows</div>
    {leavingWorld&&<WorldLoadingOverlay tone="club" label="Leaving A.R.I.S.E Arcade…" />}
  </main>;
}
