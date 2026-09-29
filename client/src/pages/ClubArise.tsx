import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { ArrowLeft, Gamepad2, MessageCircle, Trophy, UserRound, Users, X, Zap } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";
import { getAvatarCharacter } from "@/lib/avatarCharacters";

type Player={
  user_id:number;display_name:string;character_id:string;x:number;z:number;facing:number;
  phrase?:string|null;phrase_at?:string|null;updated_at:string;
};
type Match={id:string;game_type:"four"|"word_tiles"|"word_rescue";status:string;player1_id:number;player2_id:number|null;state:any;winner_id:number|null;players?:Array<{user_id:number;display_name:string;character_id:string}>};
type PlayerProfile={
  userId:number;displayName:string;characterId:string;leaderboardPoints:number;quizzesTaken:number;
  club:{played:number;wins:number;ties:number;losses:number;score:number;byGame:Record<string,{played:number;wins:number}>};
};
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
function addNeonBox(scene:THREE.Scene,size:[number,number,number],pos:[number,number,number],color:number,intensity=2.4){
  const m=new THREE.Mesh(new THREE.BoxGeometry(...size),new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:intensity,roughness:.35}));
  m.position.set(...pos);scene.add(m);return m;
}
function stationColor(id:Station["id"]){return id==="four"?0x2563eb:id==="word_tiles"?0x7c3aed:0x059669;}

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
  const root=new THREE.Group();root.position.set(station.x,0,station.z);scene.add(root);
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
  return root;
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
  const [notice,setNotice]=useState("Pick a game below or explore the arcade.");
  const [selectedPlayer,setSelectedPlayer]=useState<PlayerProfile|null>(null);
  const [playerLoading,setPlayerLoading]=useState(false);

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
    const scene=new THREE.Scene();scene.background=new THREE.Color(0x070b1a);scene.fog=new THREE.FogExp2(0x11152b,.014);sceneRef.current=scene;
    const camera=new THREE.PerspectiveCamera(52,mount.clientWidth/mount.clientHeight,.1,120);camera.position.set(0,15,24);cameraRef.current=camera;
    const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance"});renderer.setSize(mount.clientWidth,mount.clientHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.shadowMap.enabled=true;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.domElement.className="absolute inset-0 h-full w-full";mount.appendChild(renderer.domElement);rendererRef.current=renderer;
    const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,1.3,2);controls.enableDamping=true;controls.maxPolarAngle=Math.PI*.47;controls.minDistance=8;controls.maxDistance=36;controlsRef.current=controls;
    scene.add(new THREE.HemisphereLight(0x8fb7ff,0x171226,1.7));
    const key=new THREE.DirectionalLight(0xc9dcff,2.2);key.position.set(-10,18,8);key.castShadow=true;scene.add(key);
    const ground=new THREE.Mesh(new THREE.CircleGeometry(31,96),new THREE.MeshStandardMaterial({color:0x12152a,roughness:.72,metalness:.18}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;ground.userData.ground=true;scene.add(ground);
    const grid=new THREE.GridHelper(56,28,0x22d3ee,0x312e81);grid.position.y=.025;(grid.material as THREE.Material).transparent=true;(grid.material as THREE.Material).opacity=.32;scene.add(grid);

    // Neon arcade clubhouse.
    addBox(scene,[18,6,6],[0,3,-24],0x17152c);addNeonBox(scene,[15,.18,.18],[0,5.55,-20.9],0x22d3ee,4);
    addNeonBox(scene,[.18,4.3,.18],[-8.1,3,-20.9],0xa855f7,3.4);addNeonBox(scene,[.18,4.3,.18],[8.1,3,-20.9],0xec4899,3.4);
    const clubSign=makeLabel("CLUB A.R.I.S.E.","#111827","#67e8f9");clubSign.position.set(0,7,-21);clubSign.scale.set(8.5,2.1,1);scene.add(clubSign);
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
    const click=async(e:PointerEvent)=>{
      const rect=renderer.domElement.getBoundingClientRect();pointer.x=((e.clientX-rect.left)/rect.width)*2-1;pointer.y=-((e.clientY-rect.top)/rect.height)*2+1;ray.setFromCamera(pointer,camera);
      const hits=ray.intersectObjects(scene.children,true);

      for(const hit of hits){
        let node:THREE.Object3D|null=hit.object;
        while(node){
          const uid=Number(node.userData?.userId||0);
          if(uid&&uid!==self.userId){
            setPlayerLoading(true);setSelectedPlayer(null);
            try{
              const response=await fetch(API_BASE+"/api/club-arise/players/"+uid+"/profile",{headers:{Authorization:"Bearer "+token},cache:"no-store"});
              const data=await response.json();
              if(response.ok)setSelectedPlayer(data);else setNotice(data.message||"Could not load player.");
            }catch{setNotice("Could not load player.");}
            finally{setPlayerLoading(false);}
            return;
          }
          node=node.parent;
        }
      }

      const hit=hits.find(h=>{let o:THREE.Object3D|null=h.object;while(o){if(o.userData.ground)return true;o=o.parent;}return false;});
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
      const t=performance.now()*.001;
      discoBalls.forEach((ball,i)=>{ball.rotation.y+=dt*(.35+i*.08);ball.rotation.x+=dt*.08;});
      movingLights.forEach((light,i)=>{
        const a=t*.7+i*Math.PI*2/3;
        light.position.x=Math.cos(a)*12;
        light.position.z=-2+Math.sin(a)*10;
        light.position.y=7.5+Math.sin(a*1.7)*1.5;
      });
      controls.update();renderer.render(scene,camera);raf=requestAnimationFrame(loop);
    };loop();
    setReady(true);

    const resize=()=>{camera.aspect=mount.clientWidth/mount.clientHeight;camera.updateProjectionMatrix();renderer.setSize(mount.clientWidth,mount.clientHeight);};window.addEventListener("resize",resize);
    return()=>{disposed=true;cancelAnimationFrame(raf);window.removeEventListener("resize",resize);window.removeEventListener("keydown",down);window.removeEventListener("keyup",up);renderer.domElement.removeEventListener("pointerdown",click);controls.dispose();renderer.dispose();remoteRootsRef.current.clear();if(renderer.domElement.parentElement===mount)mount.removeChild(renderer.domElement);};
  },[self,token]);

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

    <div className="absolute bottom-4 left-1/2 z-40 w-[min(760px,94vw)] -translate-x-1/2 rounded-[1.7rem] border border-cyan-300/20 bg-slate-950/88 p-2.5 shadow-2xl backdrop-blur-xl">
      <div className="mb-2 flex items-center justify-between px-1">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.22em] text-cyan-300">Arcade games</p>
          <p className="text-xs font-bold text-white/55">Tap a game anytime — walking to the cabinets is optional.</p>
        </div>
        <Zap className="h-5 w-5 text-amber-300" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {STATIONS.map(station=>(
          <button
            key={station.id}
            type="button"
            onClick={()=>void joinGame(station)}
            className={"min-h-16 rounded-2xl border px-3 py-2 text-left transition hover:-translate-y-0.5 "+
              (station.id==="four"
                ?"border-blue-300/30 bg-blue-500/20 hover:bg-blue-500/30"
                :station.id==="word_tiles"
                  ?"border-violet-300/30 bg-violet-500/20 hover:bg-violet-500/30"
                  :"border-emerald-300/30 bg-emerald-500/20 hover:bg-emerald-500/30")}
          >
            <span className="block text-sm font-black leading-tight">{station.name}</span>
            <span className="mt-1 hidden text-[10px] font-bold text-white/55 sm:block">{station.subtitle}</span>
          </button>
        ))}
      </div>
    </div>

    {(selectedPlayer||playerLoading)&&!gameOpen&&(
      <aside className="absolute right-3 top-20 z-40 w-[min(330px,calc(100%-1.5rem))] rounded-[1.8rem] border border-white/15 bg-slate-950/92 p-4 shadow-2xl backdrop-blur-xl">
        <div className="flex items-start gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-cyan-400/15 text-cyan-300">
            <UserRound className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-white/45">Player profile</p>
            <h2 className="truncate text-xl font-black">{playerLoading?"Loading…":selectedPlayer?.displayName}</h2>
          </div>
          <button type="button" onClick={()=>setSelectedPlayer(null)} className="grid h-10 w-10 place-items-center rounded-xl bg-white/10"><X className="h-4 w-4"/></button>
        </div>
        {selectedPlayer&&(
          <>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-amber-400/10 p-3 ring-1 ring-amber-300/20">
                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-amber-200"><Trophy className="h-3.5 w-3.5"/> A.R.I.S.E. points</div>
                <div className="mt-1 text-2xl font-black text-amber-300">{selectedPlayer.leaderboardPoints.toLocaleString()}</div>
              </div>
              <div className="rounded-2xl bg-cyan-400/10 p-3 ring-1 ring-cyan-300/20">
                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-cyan-200"><Gamepad2 className="h-3.5 w-3.5"/> Club score</div>
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

    {nearStation&&!gameOpen&&<div className="absolute bottom-28 left-1/2 z-30 w-[min(420px,90vw)] -translate-x-1/2 rounded-3xl bg-white p-5 text-slate-950 shadow-2xl">
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

    <div className="absolute bottom-28 right-3 z-20 rounded-xl bg-black/50 px-3 py-2 text-xs font-bold text-white/70">Click a player for stats · click floor to walk · WASD / arrows</div>
  </main>;
}
