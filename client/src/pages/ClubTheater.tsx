import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS3DObject, CSS3DRenderer } from "three/examples/jsm/renderers/CSS3DRenderer.js";
import { ArrowLeft, Coins, Popcorn, Users, Volume2, VolumeX } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";
import { getAvatarCharacter } from "@/lib/avatarCharacters";
import { createPet, findPetRoot, openPetCare } from "@/lib/pets";
import MobileMovePad from "@/components/MobileMovePad";

type Movie={id:string;title:string;subtitle:string;youtubeId:string;youtubePlaylistId?:string;kind?:"video"|"channel";duration:number;license:string;attribution:string;age:string;category?:string;emoji?:string};
type TheaterVisitor={userId:number;displayName:string;characterId:string;petId:string;x:number;z:number;facing:number;seatId:string|null};
type TheaterPayload={state:{movieId:string;positionSeconds:number;startedAt:number;playing:boolean;currentPosition:number;audience:number;players:TheaterVisitor[]};movies:Movie[];changeCost:number;popcornCost:number;wallet:number};
type ClubSelf={userId:number;displayName:string;characterId:string;petId:string};

const SEATS=Array.from({length:12},(_,i)=>({id:"S"+(i+1),row:Math.floor(i/4),col:i%4}));

export default function ClubTheater(){
  const {token}=useAuth();
  const [,navigate]=useLocation();
  const mountRef=useRef<HTMLDivElement>(null);
  const youtubeRef=useRef<HTMLIFrameElement|null>(null);
  const cssSceneRef=useRef<THREE.Scene|null>(null);
  const cssRendererRef=useRef<CSS3DRenderer|null>(null);
  const rootRef=useRef<THREE.Group|null>(null);
  const cameraRef=useRef<THREE.PerspectiveCamera|null>(null);
  const controlsRef=useRef<OrbitControls|null>(null);
  const sceneRef=useRef<THREE.Scene|null>(null);
  const remoteRootsRef=useRef<Map<number,THREE.Group>>(new Map());
  const targetRef=useRef(new THREE.Vector3(0,0,10));
  const seatRef=useRef<string|null>(null);
  const mutedRef=useRef(false);
  const keysRef=useRef(new Set<string>());
  const [payload,setPayload]=useState<TheaterPayload|null>(null);
  const [self,setSelf]=useState<ClubSelf|null>(null);
  const [muted,setMuted]=useState(false);
  const [seat,setSeat]=useState<string|null>(null);
  const [popcorn,setPopcorn]=useState<"idle"|"ordering"|"eating">("idle");
  const [picker,setPicker]=useState(false);
  const [busy,setBusy]=useState(false);
  const [videoReady,setVideoReady]=useState(false);
  const [embedStart,setEmbedStart]=useState(0);
  const [notice,setNotice]=useState("You start in the center. Explore the auditorium, lobby, popcorn stand, and other readers.");
  const headers=useMemo(()=>({Authorization:"Bearer "+token,"Content-Type":"application/json"}),[token]);

  const load=async()=>{
    if(!token)return;
    try{
      const [theaterRes,clubRes]=await Promise.all([
        fetch(API_BASE+"/api/club-theater",{headers:{Authorization:"Bearer "+token},cache:"no-store"}),
        fetch(API_BASE+"/api/club-arise/bootstrap",{headers:{Authorization:"Bearer "+token},cache:"no-store"})
      ]);
      const theater=await theaterRes.json();
      if(!theaterRes.ok)throw new Error(theater.message||"Could not open the theater.");
      setPayload(theater);
      if(clubRes.ok){
        const club=await clubRes.json();
        setSelf(club.self);
      }
    }catch(e:any){
      setNotice(e.message||"Could not open the theater.");
    }
  };

  useEffect(()=>{void load();},[token]);
  useEffect(()=>{seatRef.current=seat;},[seat]);
  useEffect(()=>{mutedRef.current=muted;},[muted]);
  useEffect(()=>{
    if(!token)return;
    const timer=window.setInterval(()=>void load(),5000);
    return()=>window.clearInterval(timer);
  },[token]);

  useEffect(()=>{
    if(!token)return;
    const sync=async()=>{
      const root=rootRef.current;if(!root)return;
      try{
        const r=await fetch(API_BASE+"/api/club-theater/presence",{method:"POST",headers,body:JSON.stringify({x:root.position.x,z:root.position.z,facing:root.rotation.y,seatId:seatRef.current})});
        if(r.ok){
          const d=await r.json();
          setPayload(prev=>prev?{...prev,state:{...prev.state,...d.state}}:prev);
        }
      }catch{}
    };
    const timer=window.setInterval(sync,850);
    const leave=()=>{try{navigator.sendBeacon?.(API_BASE+"/api/club-theater/leave",new Blob([],{type:"application/json"}));}catch{}};
    window.addEventListener("pagehide",leave);
    return()=>{window.clearInterval(timer);window.removeEventListener("pagehide",leave);void fetch(API_BASE+"/api/club-theater/leave",{method:"POST",headers}).catch(()=>{});};
  },[token,headers]);

  const currentMovie=payload?.movies.find(m=>m.id===payload.state.movieId)||payload?.movies[0];
  const guideCategories=["Featured","TV Channels","Open Movies"];
  const stationIndex=Math.max(0,payload?.movies.findIndex(m=>m.id===payload.state.movieId)??0);

  useEffect(()=>{
    if(currentMovie&&payload){
      setEmbedStart(Math.max(0,Math.floor(payload.state.currentPosition||0)));
      setVideoReady(false);
    }
  },[currentMovie?.id]);

  const youtubeCommand=(func:string)=>{
    const frame=youtubeRef.current;
    if(!frame?.contentWindow)return;
    frame.contentWindow.postMessage(JSON.stringify({event:"command",func,args:[]}),"*");
  };

  useEffect(()=>{
    if(muted)youtubeCommand("mute");
    else{
      youtubeCommand("unMute");
      youtubeCommand("playVideo");
      setVideoReady(true);
    }
  },[muted]);

  useEffect(()=>{
    // Enter the cinema with sound requested on. Mobile browsers may delay
    // audible autoplay until the first touch, so retry both immediately and
    // on the first user gesture without ever defaulting the movie to mute.
    setMuted(false);
    mutedRef.current=false;
    const tryPlay=()=>{youtubeCommand("unMute");youtubeCommand("playVideo");};
    const timers=[250,900,1800].map(ms=>window.setTimeout(tryPlay,ms));
    const firstGesture=()=>{tryPlay();window.removeEventListener("pointerdown",firstGesture,true);};
    window.addEventListener("pointerdown",firstGesture,true);
    return()=>{timers.forEach(window.clearTimeout);window.removeEventListener("pointerdown",firstGesture,true);};
  },[currentMovie?.id]);

  useEffect(()=>{
    const iframe=youtubeRef.current;
    if(!iframe||!currentMovie)return;
    const src=currentMovie.kind==="channel"&&currentMovie.youtubePlaylistId
      ?"https://www.youtube-nocookie.com/embed/videoseries?list="+encodeURIComponent(currentMovie.youtubePlaylistId)+"&autoplay=1&mute=0&playsinline=1&controls=0&rel=0&enablejsapi=1&loop=1"
      :"https://www.youtube-nocookie.com/embed/"+currentMovie.youtubeId+"?autoplay=1&mute=0&playsinline=1&controls=0&rel=0&modestbranding=1&enablejsapi=1&start="+Math.max(0,Math.floor(payload?.state.currentPosition||0));
    iframe.title=currentMovie.title;
    if(iframe.src!==src){
      setVideoReady(false);
      iframe.src=src;
    }
  },[currentMovie?.id]);

  useEffect(()=>{
    const mount=mountRef.current;
    if(!mount)return;
    let disposed=false;
    const scene=new THREE.Scene();
    const cssScene=new THREE.Scene();
    sceneRef.current=scene;
    cssSceneRef.current=cssScene;

    // The YouTube screen is a CSS3D iframe. Render it BEHIND the transparent
    // WebGL layer so avatars, seats, curtains, rails, etc. can properly cover
    // the movie instead of the iframe painting over everything.
    scene.background=null;
    scene.fog=new THREE.Fog(0x101423,38,72);
    mount.style.background="#101423";

    const camera=new THREE.PerspectiveCamera(52,mount.clientWidth/Math.max(1,mount.clientHeight),.1,100);
    camera.position.set(0,5.6,18.5);
    cameraRef.current=camera;

    const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance",alpha:true});
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));
    renderer.setSize(mount.clientWidth,mount.clientHeight);
    renderer.setClearColor(0x101423,0);
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.shadowMap.enabled=true;
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.position="absolute";
    renderer.domElement.style.inset="0";
    renderer.domElement.style.zIndex="2";
    renderer.domElement.style.pointerEvents="auto";

    const cssRenderer=new CSS3DRenderer();
    cssRenderer.setSize(mount.clientWidth,mount.clientHeight);
    cssRenderer.domElement.style.position="absolute";
    cssRenderer.domElement.style.inset="0";
    cssRenderer.domElement.style.zIndex="1";
    cssRenderer.domElement.style.pointerEvents="none";
    cssRenderer.domElement.style.overflow="hidden";
    mount.appendChild(cssRenderer.domElement);
    cssRendererRef.current=cssRenderer;

    const controls=new OrbitControls(camera,renderer.domElement);
    controlsRef.current=controls;
    controls.target.set(0,1.5,10);
    controls.enableDamping=true;
    controls.dampingFactor=.09;

    // One consistent third-person camera: drag/touch always looks around.
    // Panning is disabled so walking can never accidentally push the target
    // into the ceiling/"sky" and require a separate rotate mode to recover.
    controls.enablePan=false;
    controls.screenSpacePanning=false;
    controls.mouseButtons.LEFT=THREE.MOUSE.ROTATE;
    controls.mouseButtons.RIGHT=THREE.MOUSE.ROTATE;
    controls.touches.ONE=THREE.TOUCH.ROTATE;
    controls.touches.TWO=THREE.TOUCH.DOLLY_ROTATE;
    controls.minDistance=5.2;
    controls.maxDistance=12.5;
    controls.minPolarAngle=Math.PI*.31;
    controls.maxPolarAngle=Math.PI*.47;

    scene.add(new THREE.AmbientLight(0xffffff,1.05));
    scene.add(new THREE.HemisphereLight(0xdbeafe,0x4a2633,2.35));
    const houseLight=new THREE.DirectionalLight(0xfff4dd,2.4);
    houseLight.position.set(-7,14,18);
    houseLight.castShadow=true;
    scene.add(houseLight);

    const screenGlow=new THREE.PointLight(0x9be7ff,6.5,30);
    screenGlow.position.set(0,5,-8);
    scene.add(screenGlow);

    // Soft ceiling lights keep the room readable while still feeling like a cinema.
    for(const z of [-2,5,12,19,25]){
      const ceilingLight=new THREE.PointLight(z<12?0xffe8c7:0xffd39a,2.8,13,1.6);
      ceilingLight.position.set(0,8.5,z);
      scene.add(ceilingLight);
    }
    for(const x of [-8,8]){
      const fill=new THREE.PointLight(0xc7d2fe,2.1,15,1.5);
      fill.position.set(x,6,10);
      scene.add(fill);
    }

    const floor=new THREE.Mesh(
      new THREE.PlaneGeometry(30,58),
      new THREE.MeshStandardMaterial({color:0x2b1a2c,roughness:.86})
    );
    floor.rotation.x=-Math.PI/2;
    floor.position.z=9;
    floor.receiveShadow=true;
    floor.userData.ground=true;
    scene.add(floor);

    // Camera blockers keep orbit/pan controls inside the actual room instead of
    // letting the camera pass through a wall, a seat, or behind the movie screen.
    const cameraBlockers:THREE.Object3D[]=[];

    // Build the screen wall with a real opening. This lets the CSS3D movie
    // show through the transparent WebGL canvas while WebGL objects remain in
    // front of it and can naturally occlude it.
    const backWallMat=new THREE.MeshStandardMaterial({color:0x100811,roughness:.88});
    const backPieces=[
      {size:[6.1,11,.7] as [number,number,number],pos:[-10.95,5.5,-10] as [number,number,number]},
      {size:[6.1,11,.7] as [number,number,number],pos:[10.95,5.5,-10] as [number,number,number]},
      {size:[15.8,1.15,.7] as [number,number,number],pos:[0,.575,-10] as [number,number,number]},
      {size:[15.8,1.3,.7] as [number,number,number],pos:[0,10.35,-10] as [number,number,number]}
    ];
    for(const piece of backPieces){
      const wallPiece=new THREE.Mesh(new THREE.BoxGeometry(...piece.size),backWallMat);
      wallPiece.position.set(...piece.pos);
      scene.add(wallPiece);
      cameraBlockers.push(wallPiece);
    }

    for(const x of [-14,14]){
      const wall=new THREE.Mesh(new THREE.BoxGeometry(.7,11,58),new THREE.MeshStandardMaterial({color:0x120914}));
      wall.position.set(x,5.5,9);
      scene.add(wall);
      cameraBlockers.push(wall);
    }

    // A real ceiling and rear lobby wall remove the remaining "blank sky"
    // angles and also give the camera solid surfaces to collide with.
    const ceiling=new THREE.Mesh(
      new THREE.BoxGeometry(28,.32,38),
      new THREE.MeshStandardMaterial({color:0x0b1020,roughness:.92})
    );
    ceiling.position.set(0,9.85,9);
    scene.add(ceiling);
    cameraBlockers.push(ceiling);

    const lobbyBackWall=new THREE.Mesh(
      new THREE.BoxGeometry(28,11,.7),
      new THREE.MeshStandardMaterial({color:0x171126,roughness:.86})
    );
    lobbyBackWall.position.set(0,5.5,28.4);
    scene.add(lobbyBackWall);
    cameraBlockers.push(lobbyBackWall);

    // Four frame bars instead of one solid box, so the video is never covered
    // by its own WebGL frame.
    const frameMat=new THREE.MeshStandardMaterial({color:0x08080d,metalness:.55,roughness:.25});
    const frameParts=[
      {size:[16.5,.55,.5] as [number,number,number],pos:[0,9.625,-9.35] as [number,number,number]},
      {size:[16.5,.55,.5] as [number,number,number],pos:[0,1.175,-9.35] as [number,number,number]},
      {size:[.55,7.9,.5] as [number,number,number],pos:[-7.975,5.4,-9.35] as [number,number,number]},
      {size:[.55,7.9,.5] as [number,number,number],pos:[7.975,5.4,-9.35] as [number,number,number]}
    ];
    for(const part of frameParts){
      const framePart=new THREE.Mesh(new THREE.BoxGeometry(...part.size),frameMat);
      framePart.position.set(...part.pos);
      scene.add(framePart);
      cameraBlockers.push(framePart);
    }

    // Stage, curtains and speaker towers make the screen feel anchored in a real cinema.
    const stageFloor=new THREE.Mesh(new THREE.BoxGeometry(18.5,.45,3.2),new THREE.MeshStandardMaterial({color:0x130d16,roughness:.55,metalness:.08}));
    stageFloor.position.set(0,.18,-6.85);stageFloor.receiveShadow=true;scene.add(stageFloor);
    const curtainMat=new THREE.MeshStandardMaterial({color:0x7f0f1d,roughness:.78});
    for(const x of [-8.25,8.25]){
      const curtain=new THREE.Mesh(new THREE.BoxGeometry(1.45,9.2,.55),curtainMat);
      curtain.position.set(x,5.2,-8.72);curtain.castShadow=true;scene.add(curtain);
      for(let fold=0;fold<4;fold++){
        const pleat=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,8.6,12),new THREE.MeshStandardMaterial({color:fold%2?0x5b0b16:0x991b2c,roughness:.82}));
        pleat.position.set(x+(fold-1.5)*.28,5.2,-8.38);scene.add(pleat);
      }
    }
    const valance=new THREE.Mesh(new THREE.BoxGeometry(17.9,1.05,.65),curtainMat);
    valance.position.set(0,9.25,-8.72);scene.add(valance);
    const speakerMat=new THREE.MeshStandardMaterial({color:0x080b12,roughness:.42,metalness:.28});
    for(const x of [-10.45,10.45]){
      const tower=new THREE.Mesh(new THREE.BoxGeometry(1.7,5.2,1.55),speakerMat);tower.position.set(x,2.85,-7.55);scene.add(tower);
      for(const y of [1.55,2.85,4.15]){const cone=new THREE.Mesh(new THREE.CylinderGeometry(.48,.34,.18,24),new THREE.MeshStandardMaterial({color:0x1f2937,roughness:.45,metalness:.25}));cone.rotation.x=Math.PI/2;cone.position.set(x,y,-6.73);scene.add(cone);}
    }
    const frontRailMat=new THREE.MeshStandardMaterial({color:0xc7a34a,metalness:.72,roughness:.25});
    for(const x of [-5.8,5.8]){const post=new THREE.Mesh(new THREE.CylinderGeometry(.08,.1,1.15,12),frontRailMat);post.position.set(x,.75,-5.35);scene.add(post);}
    const rope=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,11.6,12),new THREE.MeshStandardMaterial({color:0x8b1e2d,roughness:.68}));
    rope.rotation.z=Math.PI/2;rope.position.set(0,1.1,-5.35);scene.add(rope);

    if(currentMovie){
      const screenWrap=document.createElement("div");
      screenWrap.style.width="800px";
      screenWrap.style.height="450px";
      screenWrap.style.background="#000";
      screenWrap.style.overflow="hidden";
      screenWrap.style.borderRadius="8px";
      screenWrap.style.boxShadow="0 0 45px rgba(56,189,248,.22)";

      const iframe=document.createElement("iframe");
      youtubeRef.current=iframe;
      iframe.src=currentMovie.kind==="channel"&&currentMovie.youtubePlaylistId
        ?"https://www.youtube-nocookie.com/embed/videoseries?list="+encodeURIComponent(currentMovie.youtubePlaylistId)+"&autoplay=1&mute=0&playsinline=1&controls=0&rel=0&enablejsapi=1&loop=1"
        :"https://www.youtube-nocookie.com/embed/"+currentMovie.youtubeId+"?autoplay=1&mute=0&playsinline=1&controls=0&rel=0&modestbranding=1&enablejsapi=1&start="+Math.max(0,Math.floor(payload?.state.currentPosition||embedStart||0));
      iframe.title=currentMovie.title;
      iframe.allow="autoplay; encrypted-media; picture-in-picture";
      iframe.style.width="800px";
      iframe.style.height="450px";
      iframe.style.border="0";
      iframe.style.display="block";
      iframe.style.pointerEvents="none";
      iframe.addEventListener("load",()=>{
        setVideoReady(true);
        window.setTimeout(()=>{youtubeCommand("playVideo");if(mutedRef.current)youtubeCommand("mute");else youtubeCommand("unMute");},250);
      });
      screenWrap.appendChild(iframe);

      const movieObject=new CSS3DObject(screenWrap);
      movieObject.position.set(0,5.4,-8.96);
      movieObject.scale.set(.018,.018,.018);
      cssScene.add(movieObject);
    }

    const aisle=new THREE.Mesh(
      new THREE.PlaneGeometry(2.7,31),
      new THREE.MeshStandardMaterial({color:0x5a1422,roughness:.75,emissive:0x5a1422,emissiveIntensity:.35})
    );
    aisle.rotation.x=-Math.PI/2;
    aisle.position.set(0,.02,6);
    scene.add(aisle);

    for(const x of [-11.5,11.5]){
      for(const z of [-5,2,9,16]){
        const lamp=new THREE.PointLight(0xffc56d,2.5,8,1.6);
        lamp.position.set(x,2.5,z);
        scene.add(lamp);
      }
    }

    const rayTargets:THREE.Object3D[]=[floor];
    const riserMat=new THREE.MeshStandardMaterial({color:0x211520,roughness:.82});
    for(let row=0;row<3;row++){
      const z=2+row*3.7;
      for(const x of [-7.2,7.2]){
        const riser=new THREE.Mesh(new THREE.BoxGeometry(11.7,.22+row*.11,3.15),riserMat);
        riser.position.set(x,.11+row*.055,z);riser.receiveShadow=true;scene.add(riser);
      }
    }
    SEATS.forEach(s=>{
      const x=(s.col-1.5)*3.2+(s.col<2?-1.25:1.25);
      const z=2+s.row*3.7;
      const root=new THREE.Group();
      root.position.set(x,.18+s.row*.1,z);
      root.userData.seatId=s.id;
      scene.add(root);

      const leather=new THREE.MeshStandardMaterial({color:0x6f101b,roughness:.42,metalness:.05});
      const leatherDark=new THREE.MeshStandardMaterial({color:0x3e0c14,roughness:.5});
      const trimMat=new THREE.MeshStandardMaterial({color:0x111827,roughness:.35,metalness:.3});

      const base=new THREE.Mesh(new THREE.CylinderGeometry(.78,.92,.42,24),trimMat);
      base.position.y=.28;base.scale.z=1.15;root.add(base);

      const cushion=new THREE.Mesh(new THREE.BoxGeometry(2.18,.5,1.9),leather);
      cushion.position.set(0,.68,-.05);cushion.rotation.x=.05;cushion.castShadow=true;root.add(cushion);

      const backrest=new THREE.Mesh(new THREE.BoxGeometry(2.2,2.25,.5),leather);
      backrest.position.set(0,1.72,.68);backrest.rotation.x=-.14;backrest.castShadow=true;root.add(backrest);

      const headrest=new THREE.Mesh(new THREE.BoxGeometry(1.75,.72,.58),leatherDark);
      headrest.position.set(0,2.55,.83);headrest.rotation.x=-.14;headrest.castShadow=true;root.add(headrest);
      cameraBlockers.push(cushion,backrest,headrest);

      const lumbar=new THREE.Mesh(new THREE.BoxGeometry(1.62,.52,.18),new THREE.MeshStandardMaterial({color:0x8f1725,roughness:.48}));
      lumbar.position.set(0,1.62,.38);lumbar.rotation.x=-.12;root.add(lumbar);

      for(const ax of [-1.24,1.24]){
        const arm=new THREE.Mesh(new THREE.BoxGeometry(.28,.7,1.82),leatherDark);
        arm.position.set(ax,.93,.03);arm.castShadow=true;root.add(arm);
        const cap=new THREE.Mesh(new THREE.BoxGeometry(.36,.16,1.42),trimMat);
        cap.position.set(ax,1.29,-.02);root.add(cap);
      }

      const cupRing=new THREE.Mesh(new THREE.TorusGeometry(.18,.045,10,24),new THREE.MeshStandardMaterial({color:0x9ca3af,metalness:.82,roughness:.2}));
      cupRing.rotation.x=Math.PI/2;cupRing.position.set(1.24,1.39,-.28);root.add(cupRing);
      const cupHole=new THREE.Mesh(new THREE.CylinderGeometry(.135,.135,.1,18),new THREE.MeshBasicMaterial({color:0x030712}));
      cupHole.position.set(1.24,1.34,-.28);root.add(cupHole);

      const stitchMat=new THREE.MeshBasicMaterial({color:0xd6a5a5});
      for(const sx of [-.78,.78]){const stitch=new THREE.Mesh(new THREE.BoxGeometry(.025,1.45,.025),stitchMat);stitch.position.set(sx,1.82,.39);stitch.rotation.x=-.14;root.add(stitch);}

      const hit=new THREE.Mesh(
        new THREE.BoxGeometry(2.75,3.2,2.55),
        new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false})
      );
      hit.position.y=1.45;
      hit.userData.seatId=s.id;
      root.add(hit);
      rayTargets.push(hit);
    });

    // Aisle guide lights, ceiling stars and exit signage.
    for(let z=-3;z<=16;z+=2.4){
      for(const x of [-1.7,1.7]){
        const guide=new THREE.Mesh(new THREE.BoxGeometry(.16,.06,.52),new THREE.MeshBasicMaterial({color:0xfbbf24}));
        guide.position.set(x,.065,z);scene.add(guide);
      }
    }
    const starGeo=new THREE.SphereGeometry(.045,8,6),starMat=new THREE.MeshBasicMaterial({color:0xdbeafe});
    for(let i=0;i<80;i++){const star=new THREE.Mesh(starGeo,starMat);star.position.set(-12+(i*7.13)%24,9.4+(i%4)*.08,-5+(i*5.77)%29);scene.add(star);}
    for(const [x,z] of [[-13,14],[13,14]] as [number,number][]){
      const exitBox=new THREE.Mesh(new THREE.BoxGeometry(2.2,.8,.18),new THREE.MeshStandardMaterial({color:0x064e3b,emissive:0x10b981,emissiveIntensity:1.2}));
      exitBox.position.set(x,5.4,z);scene.add(exitBox);
      const exitGlow=new THREE.PointLight(0x34d399,1.6,5);exitGlow.position.set(x,5,z-.4);scene.add(exitGlow);
    }

    // Lobby / concession area behind the auditorium
    const lobbyFloor=new THREE.Mesh(new THREE.PlaneGeometry(28,14),new THREE.MeshStandardMaterial({color:0x24111c,roughness:.8}));
    lobbyFloor.rotation.x=-Math.PI/2;lobbyFloor.position.set(0,.025,22);scene.add(lobbyFloor);

    const counter=new THREE.Mesh(new THREE.BoxGeometry(7.5,1.3,2.4),new THREE.MeshStandardMaterial({color:0x78350f,roughness:.65}));
    counter.position.set(-8.7,.65,22.5);scene.add(counter);
    const counterTop=new THREE.Mesh(new THREE.BoxGeometry(7.9,.2,2.7),new THREE.MeshStandardMaterial({color:0xf8fafc,roughness:.3}));
    counterTop.position.set(-8.7,1.35,22.5);scene.add(counterTop);
    const sign=new THREE.Mesh(new THREE.BoxGeometry(5.2,.9,.22),new THREE.MeshStandardMaterial({color:0xfacc15,emissive:0xf59e0b,emissiveIntensity:.9}));
    sign.position.set(-8.7,4.1,21.7);scene.add(sign);
    const signLabel=document.createElement("canvas");signLabel.width=512;signLabel.height=128;const sctx=signLabel.getContext("2d")!;
    sctx.fillStyle="#facc15";sctx.fillRect(0,0,512,128);sctx.fillStyle="#3f1d0b";sctx.font="900 42px system-ui";sctx.textAlign="center";sctx.textBaseline="middle";sctx.fillText("POPCORN • SNACKS",256,64);
    const signTex=new THREE.CanvasTexture(signLabel);signTex.colorSpace=THREE.SRGBColorSpace;
    const signFront=new THREE.Mesh(new THREE.PlaneGeometry(5,.78),new THREE.MeshBasicMaterial({map:signTex}));signFront.position.set(-8.7,4.1,21.58);scene.add(signFront);
    for(let i=0;i<5;i++){
      const tub=new THREE.Mesh(new THREE.CylinderGeometry(.42,.34,.7,14),new THREE.MeshStandardMaterial({color:i%2?0xffffff:0xef4444,roughness:.6}));
      tub.position.set(-10.6+i*.95,1.8,22);scene.add(tub);
      for(let k=0;k<7;k++){const kernel=new THREE.Mesh(new THREE.SphereGeometry(.11,10,8),new THREE.MeshStandardMaterial({color:0xfff1a8,roughness:.7}));kernel.position.set(tub.position.x+(k%3-.8)*.13,2.18+Math.floor(k/3)*.08,21.95);scene.add(kernel);}
    }

    // Ticket booth, movie posters, lobby benches and discoverable decor.
    const booth=new THREE.Mesh(new THREE.BoxGeometry(4.2,3.5,2.6),new THREE.MeshStandardMaterial({color:0x312e81,roughness:.55}));
    booth.position.set(8.8,1.75,23.2);scene.add(booth);
    const boothWindow=new THREE.Mesh(new THREE.PlaneGeometry(2.6,1.25),new THREE.MeshBasicMaterial({color:0x67e8f9}));
    boothWindow.position.set(8.8,2.25,21.88);scene.add(boothWindow);
    for(const x of [-5.5,0,5.5]){
      const posterFrame=new THREE.Mesh(new THREE.BoxGeometry(3,4.2,.22),new THREE.MeshStandardMaterial({color:0x111827,metalness:.35}));
      posterFrame.position.set(x,3.4,27.4);scene.add(posterFrame);
      const poster=new THREE.Mesh(new THREE.PlaneGeometry(2.65,3.85),new THREE.MeshBasicMaterial({color:x<0?0xf59e0b:x>0?0x22d3ee:0xa855f7}));
      poster.position.set(x,3.4,27.26);scene.add(poster);
    }
    for(const x of [-4.2,4.2]){
      const bench=new THREE.Mesh(new THREE.BoxGeometry(5,.55,1.6),new THREE.MeshStandardMaterial({color:0x7f1d1d,roughness:.55}));
      bench.position.set(x,.65,18.2);scene.add(bench);
      const benchBack=new THREE.Mesh(new THREE.BoxGeometry(5,1.5,.35),new THREE.MeshStandardMaterial({color:0x991b1b,roughness:.55}));
      benchBack.position.set(x,1.45,18.85);scene.add(benchBack);
    }
    const lobbyGlow=new THREE.PointLight(0xffc56d,5,20,1.5);lobbyGlow.position.set(0,6,22);scene.add(lobbyGlow);
    const concessionGlow=new THREE.PointLight(0xffffff,3.2,10,1.5);concessionGlow.position.set(-8.7,4.5,22);scene.add(concessionGlow);

    const avatarRoot=new THREE.Group();
    avatarRoot.position.set(0,0,10);
    scene.add(avatarRoot);
    rootRef.current=avatarRoot;
    targetRef.current.copy(avatarRoot.position);

    if(self){
      const loader=new GLTFLoader();
      const selfPet=createPet(self.petId,loader,.9);if(selfPet){selfPet.position.set(.85,0,.45);avatarRoot.add(selfPet);}
      loader.load(getAvatarCharacter(self.characterId).modelPath,gltf=>{
        if(disposed)return;
        const model=gltf.scene;
        const box=new THREE.Box3().setFromObject(model);
        const size=box.getSize(new THREE.Vector3());
        model.scale.setScalar(2.5/Math.max(.01,size.y));
        model.updateMatrixWorld(true);
        const b=new THREE.Box3().setFromObject(model);
        model.position.y=-b.min.y;
        model.traverse(o=>{if((o as THREE.Mesh).isMesh)(o as THREE.Mesh).castShadow=true;});
        avatarRoot.add(model);
        if(gltf.animations.length){
          const mixer=new THREE.AnimationMixer(model);
          const idle=gltf.animations.find(a=>/idle/i.test(a.name))||gltf.animations[0];
          mixer.clipAction(idle).play();
          avatarRoot.userData.mixer=mixer;
        }
      });
    }else{
      const body=new THREE.Mesh(new THREE.CapsuleGeometry(.5,1.2,6,10),new THREE.MeshStandardMaterial({color:0x22d3ee}));
      body.position.y=1.2;
      avatarRoot.add(body);
    }

    const ray=new THREE.Raycaster();
    const cameraRay=new THREE.Raycaster();
    const pointer=new THREE.Vector2();
    const click=(e:PointerEvent)=>{
      const rect=renderer.domElement.getBoundingClientRect();
      pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
      ray.setFromCamera(pointer,camera);
      const petHit=ray.intersectObject(avatarRoot,true).find(hit=>!!findPetRoot(hit.object));
      if(petHit){openPetCare();return;}
      const hits=ray.intersectObjects(rayTargets,true);

      for(const hit of hits){
        let node:THREE.Object3D|null=hit.object;
        while(node){
          const seatId=String(node.userData?.seatId||"");
          if(seatId){
            const s=SEATS.find(x=>x.id===seatId);
            if(s){
              const sx=(s.col-1.5)*3.2+(s.col<2?-1.25:1.25);
              const sz=2+s.row*3.7;
              targetRef.current.set(sx,.18+s.row*.1,sz+.15);
              setSeat(seatId);
              setNotice("Walking to seat "+seatId+"… The camera will switch to movie view when you sit.");
            }
            return;
          }
          node=node.parent;
        }
      }

      const hit=hits.find(h=>h.object.userData.ground);
      if(hit){
        setSeat(null);
        targetRef.current.set(
          THREE.MathUtils.clamp(hit.point.x,-12,12),
          0,
          THREE.MathUtils.clamp(hit.point.z,-4,27)
        );
      }
    };

    let start:{id:number;x:number;y:number}|null=null;
    const pointerDown=(e:PointerEvent)=>{start={id:e.pointerId,x:e.clientX,y:e.clientY};};
    const pointerUp=(e:PointerEvent)=>{
      if(!start||start.id!==e.pointerId)return;
      const moved=Math.hypot(e.clientX-start.x,e.clientY-start.y);
      start=null;
      if(moved<10)click(e);
    };
    renderer.domElement.addEventListener("pointerdown",pointerDown);
    renderer.domElement.addEventListener("pointerup",pointerUp);

    const keyDown=(e:KeyboardEvent)=>keysRef.current.add(e.key.toLowerCase());
    const keyUp=(e:KeyboardEvent)=>keysRef.current.delete(e.key.toLowerCase());
    window.addEventListener("keydown",keyDown);
    window.addEventListener("keyup",keyUp);

    const resize=()=>{
      camera.aspect=mount.clientWidth/Math.max(1,mount.clientHeight);
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth,mount.clientHeight);
      cssRenderer.setSize(mount.clientWidth,mount.clientHeight);
    };
    window.addEventListener("resize",resize);

    const clock=new THREE.Clock();
    let raf=0;
    const loop=()=>{
      const dt=Math.min(.04,clock.getDelta());
      const root=rootRef.current;
      if(root){
        (root.userData.mixer as THREE.AnimationMixer|undefined)?.update(dt);
        const snack=root.getObjectByName("eatingPopcorn") as THREE.Group|undefined;
        if(snack){
          const elapsed=performance.now()-Number(snack.userData.startedAt||0);
          const duration=Math.max(1,Number(snack.userData.duration||3600));
          const phase=Math.max(0,Math.min(1,elapsed/duration));
          const bite=Math.max(0,Math.sin(phase*Math.PI*6));
          snack.position.y=1.02+bite*.72;
          snack.position.z=.18-bite*.2;
          snack.rotation.x=-bite*.35;
          const kernels=snack.children.filter(x=>x.userData.kernel);
          const hidden=Math.min(kernels.length,Math.floor(phase*(kernels.length+1)));
          kernels.forEach((kernel,i)=>kernel.visible=i>=hidden);
        }

        // WASD/arrows move relative to the current camera view, like a
        // normal third-person game. Looking around never changes altitude.
        const inputRight=((keysRef.current.has("d")||keysRef.current.has("arrowright"))?1:0)-((keysRef.current.has("a")||keysRef.current.has("arrowleft"))?1:0);
        const inputForward=((keysRef.current.has("w")||keysRef.current.has("arrowup"))?1:0)-((keysRef.current.has("s")||keysRef.current.has("arrowdown"))?1:0);

        if(inputRight||inputForward){
          const forward=new THREE.Vector3();
          camera.getWorldDirection(forward);
          forward.y=0;
          if(forward.lengthSq()<.0001)forward.set(0,0,-1);
          forward.normalize();
          const right=forward.clone().cross(new THREE.Vector3(0,1,0)).normalize();
          const dir=forward.multiplyScalar(inputForward).add(right.multiplyScalar(inputRight)).normalize().multiplyScalar(6*dt);
          targetRef.current.copy(root.position).add(dir);
          if(seatRef.current){
            seatRef.current=null;
            setSeat(null);
          }
        }

        const delta=targetRef.current.clone().sub(root.position);
        delta.y=0;
        if(delta.length()>.1){
          root.position.y=0;
          const step=Math.min(delta.length(),5.8*dt);
          const move=delta.normalize().multiplyScalar(step);
          root.position.add(move);
          root.position.x=THREE.MathUtils.clamp(root.position.x,-12,12);
          // Keep players on the audience side of the stage/rope.
          root.position.z=THREE.MathUtils.clamp(root.position.z,-4,27);
          root.rotation.y=Math.atan2(move.x,move.z);
        }else if(seatRef.current){
          const seated=SEATS.find(s=>s.id===seatRef.current);
          root.position.y=.58+(seated?.row||0)*.1;
          root.rotation.y=Math.PI;
        }else root.position.y=0;

        if(seatRef.current&&delta.length()<=.1){
          const seated=SEATS.find(s=>s.id===seatRef.current);
          const eyeY=2.05+(seated?.row||0)*.1;
          const desiredCamera=new THREE.Vector3(root.position.x,eyeY,root.position.z+.48);
          const screenFocus=new THREE.Vector3(0,5.15,-8.95);
          camera.position.lerp(desiredCamera,.12);
          controls.target.lerp(screenFocus,.14);
          controls.enabled=false;
        }else{
          controls.enabled=true;
          const center=new THREE.Vector3(root.position.x,1.5,root.position.z);

          // True chase-camera tracking: translate the camera exactly as much as
          // its target moved. There is no accumulating vertical or positional
          // drift, so walking cannot launch the view into the ceiling.
          const followShift=center.clone().sub(controls.target);
          controls.target.copy(center);
          camera.position.add(followShift);
        }
      }
      remoteRootsRef.current.forEach(remote=>(remote.userData.mixer as THREE.AnimationMixer|undefined)?.update(dt));
      controls.update();

      const seatedNow=!!seatRef.current;
      if(!seatedNow&&rootRef.current){
        const focus=new THREE.Vector3(rootRef.current.position.x,1.55,rootRef.current.position.z);

        // Collision shortens the chase-camera arm before it can enter a seat,
        // wall or ceiling. The camera remains anchored to the player instead
        // of being independently panned around the room.
        const offset=camera.position.clone().sub(focus);
        const distance=offset.length();
        if(distance>1.5){
          const direction=offset.clone().normalize();
          cameraRay.set(focus,direction);
          cameraRay.near=.35;
          cameraRay.far=distance;
          const obstruction=cameraRay.intersectObjects(cameraBlockers,true)[0];
          if(obstruction&&obstruction.distance<distance){
            const safeDistance=Math.max(1.7,obstruction.distance-.45);
            camera.position.copy(focus).add(direction.multiplyScalar(safeDistance));
          }
        }

        // Final safety rails for the actual room. Vertical range is narrow
        // enough that the user can look up/down without ever becoming a
        // floating "sky camera".
        camera.position.x=THREE.MathUtils.clamp(camera.position.x,-13.15,13.15);
        camera.position.y=THREE.MathUtils.clamp(camera.position.y,2.15,8.7);
        camera.position.z=THREE.MathUtils.clamp(camera.position.z,-4.75,27.65);
        controls.target.set(rootRef.current.position.x,1.5,rootRef.current.position.z);
      }else{
        camera.position.x=THREE.MathUtils.clamp(camera.position.x,-12,12);
        camera.position.y=THREE.MathUtils.clamp(camera.position.y,1.4,7.5);
        camera.position.z=THREE.MathUtils.clamp(camera.position.z,-4.75,26.6);
      }

      camera.lookAt(controls.target);
      renderer.render(scene,camera);
      cssRenderer.render(cssScene,camera);
      raf=requestAnimationFrame(loop);
    };
    loop();

    return()=>{
      disposed=true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize",resize);
      window.removeEventListener("keydown",keyDown);
      window.removeEventListener("keyup",keyUp);
      renderer.domElement.removeEventListener("pointerdown",pointerDown);
      renderer.domElement.removeEventListener("pointerup",pointerUp);
      controls.dispose();
      youtubeRef.current=null;
      cssScene.clear();
      cssSceneRef.current=null;
      cssRendererRef.current=null;
      if(cssRenderer.domElement.parentElement===mount)mount.removeChild(cssRenderer.domElement);
      sceneRef.current=null;remoteRootsRef.current.clear();
      scene.traverse(o=>{
        const m=o as THREE.Mesh;
        m.geometry?.dispose();
        if(m.material)(Array.isArray(m.material)?m.material:[m.material]).forEach(x=>x.dispose());
      });
      renderer.dispose();
      if(mount.contains(renderer.domElement))mount.removeChild(renderer.domElement);
    };
  },[self?.characterId,!!currentMovie]);

  useEffect(()=>{
    const scene=sceneRef.current;
    if(!scene||!self)return;
    const loader=new GLTFLoader();
    const active=new Set<number>();
    for(const player of payload?.state.players||[]){
      if(player.userId===self.userId)continue;
      active.add(player.userId);
      let root=remoteRootsRef.current.get(player.userId);
      if(!root){
        root=new THREE.Group();root.position.set(player.x,0,player.z);root.rotation.y=player.facing;scene.add(root);
        const canvas=document.createElement("canvas");canvas.width=384;canvas.height=96;const ctx=canvas.getContext("2d")!;ctx.fillStyle="rgba(2,6,23,.86)";ctx.fillRect(0,0,384,96);ctx.fillStyle="white";ctx.font="700 30px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(player.displayName,192,48);
        const tex=new THREE.CanvasTexture(canvas);const label=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false}));label.position.set(0,3.2,0);label.scale.set(3.5,.88,1);root.add(label);
        loader.load(getAvatarCharacter(player.characterId).modelPath,gltf=>{const model=gltf.scene;const box=new THREE.Box3().setFromObject(model);const size=box.getSize(new THREE.Vector3());model.scale.setScalar(2.5/Math.max(.01,size.y));model.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(model);model.position.y=-b.min.y;root!.add(model);if(gltf.animations.length){const mixer=new THREE.AnimationMixer(model);const idle=gltf.animations.find(a=>/idle/i.test(a.name))||gltf.animations[0];mixer.clipAction(idle).play();root!.userData.mixer=mixer;}});
        const pet=createPet(player.petId,loader,.9);if(pet){pet.position.set(.85,0,.45);root.add(pet);}
        remoteRootsRef.current.set(player.userId,root);
      }
      root.userData.mixer?.update?.(.04);
      const seatInfo=player.seatId?SEATS.find(s=>s.id===player.seatId):null;root.position.lerp(new THREE.Vector3(player.x,seatInfo ? .58+seatInfo.row*.1 : 0,player.z),.28);
      root.rotation.y=player.seatId?Math.PI:THREE.MathUtils.lerp(root.rotation.y,player.facing,.3);
    }
    remoteRootsRef.current.forEach((root,id)=>{if(!active.has(id)){scene.remove(root);remoteRootsRef.current.delete(id);}});
  },[payload?.state.players,self]);

  const changeMovie=async(movieId:string)=>{
    if(!payload||busy)return;
    if(payload.wallet<payload.changeCost){
      setNotice("You need more Reader Coins to change the movie.");
      return;
    }
    setBusy(true);
    try{
      const r=await fetch(API_BASE+"/api/club-theater/change",{method:"POST",headers,body:JSON.stringify({movieId})});
      const d=await r.json();
      if(!r.ok)throw new Error(d.message||"Could not change the movie.");
      setPayload(d);
      setPicker(false);
      setEmbedStart(0);
      setVideoReady(false);
      setNotice("The new YouTube show is starting for everyone.");
    }catch(e:any){
      setNotice(e.message||"Could not change the movie.");
    }finally{
      setBusy(false);
    }
  };

  const switchStation=(delta:number)=>{
    if(!payload?.movies.length||busy)return;
    const next=(stationIndex+delta+payload.movies.length)%payload.movies.length;
    void changeMovie(payload.movies[next].id);
  };

  const orderPopcorn=async()=>{
    if(popcorn!=="idle"||!payload||busy)return;
    if(payload.wallet<payload.popcornCost){setNotice("You need "+payload.popcornCost+" Reader Coins for popcorn.");return;}
    setPopcorn("ordering");setNotice("Buying popcorn…");
    try{
      const r=await fetch(API_BASE+"/api/club-theater/popcorn",{method:"POST",headers});
      const d=await r.json();
      if(!r.ok)throw new Error(d.message||"Could not buy popcorn.");
      setPayload(prev=>prev?{...prev,wallet:d.wallet}:prev);
      const root=rootRef.current;
      if(root){
        const previous=root.getObjectByName("eatingPopcorn");if(previous)root.remove(previous);
        const snack=new THREE.Group();snack.name="eatingPopcorn";
        const tub=new THREE.Mesh(new THREE.CylinderGeometry(.34,.28,.62,18),new THREE.MeshStandardMaterial({color:0xef4444,roughness:.6}));
        tub.position.y=.32;snack.add(tub);
        for(let i=0;i<10;i++){
          const kernel=new THREE.Mesh(new THREE.SphereGeometry(.09,8,7),new THREE.MeshStandardMaterial({color:0xfff1a8,roughness:.8}));
          kernel.position.set(((i%3)-1)*.12,.65+Math.floor(i/3)*.06,((i%2)-.5)*.12);
          kernel.userData.kernel=true;snack.add(kernel);
        }
        snack.position.set(.65,1.02,.18);snack.userData.startedAt=performance.now();snack.userData.duration=3600;root.add(snack);
      }
      setPopcorn("eating");setNotice("🍿 Yum! Your avatar is eating the popcorn.");
      window.setTimeout(()=>{
        const root=rootRef.current,old=root?.getObjectByName("eatingPopcorn");
        if(root&&old)root.remove(old);
        setPopcorn("idle");setNotice("Popcorn finished!");
      },3700);
    }catch(e:any){setPopcorn("idle");setNotice(e.message||"Could not buy popcorn.");}
  };

  const move=(key:"w"|"a"|"s"|"d",pressed:boolean)=>{if(pressed)keysRef.current.add(key);else keysRef.current.delete(key);};

  return <main className="club-world-root relative h-[100dvh] overflow-hidden bg-black text-white">
    <div ref={mountRef} className="absolute inset-0 touch-none"/>

    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center gap-2 bg-gradient-to-b from-black/90 to-transparent p-2 sm:p-4">
      <button onClick={()=>navigate("/worlds")} className="pointer-events-auto flex min-h-11 items-center gap-2 rounded-xl bg-black/70 px-3 font-black backdrop-blur">
        <ArrowLeft className="h-4 w-4"/><span className="hidden sm:inline">Exit to worlds</span>
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-black uppercase tracking-[.22em] text-amber-300">Club Arise</p>
        <h1 className="truncate text-lg font-black sm:text-2xl">🎬 Cinema Room</h1>
      </div>
      <div className="pointer-events-auto flex items-center gap-1.5 rounded-xl border border-amber-300/25 bg-black/70 px-2.5 py-2 text-sm font-black">
        <Coins className="h-4 w-4 text-amber-300"/>{payload?.wallet?.toLocaleString()??"—"}
      </div>
    </header>

    <div className="pointer-events-none absolute left-1/2 top-16 z-20 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-[9px] font-black backdrop-blur sm:top-20 sm:text-[10px]">
      {currentMovie?.emoji||"📺"} {currentMovie?.title||"Loading show…"} · {payload?.state.audience||0} watching
    </div>

    <div className="absolute left-2 top-16 z-30 flex flex-col gap-1.5 sm:left-4 sm:top-24">
      <div className="rounded-xl bg-slate-950/80 px-3 py-2 text-[10px] font-black leading-tight text-white/80 shadow-xl backdrop-blur">
        WASD/arrows: walk<br/>Drag: look around<br/>Scroll/pinch: zoom
      </div>
      <button type="button" onClick={()=>{
        const root=rootRef.current,controls=controlsRef.current,camera=cameraRef.current;
        if(root&&controls&&camera){
          seatRef.current=null;
          setSeat(null);
          targetRef.current.copy(root.position);
          const center=new THREE.Vector3(root.position.x,1.5,root.position.z);
          const resetZ=root.position.z>17?root.position.z-8:root.position.z+8;
          controls.enabled=true;
          controls.target.copy(center);
          camera.position.set(root.position.x,5.5,THREE.MathUtils.clamp(resetZ,-4.5,27.2));
          controls.update();
          setNotice("View reset. Drag anywhere to look around; use WASD/arrows to walk.");
        }
      }} className="min-h-10 rounded-xl bg-cyan-300 px-3 text-xs font-black text-slate-950 shadow-xl">Reset View</button>
    </div>

    <div className="absolute right-2 top-16 z-30 flex flex-col gap-1.5 sm:right-4 sm:top-24">
      <button type="button" onClick={()=>setMuted(value=>!value)} className="flex min-h-10 items-center gap-2 rounded-xl bg-slate-950/90 px-3 text-xs font-black shadow-xl backdrop-blur">
        {muted?<VolumeX className="h-4 w-4"/>:<Volume2 className="h-4 w-4"/>}{muted?"Hear Movie":"Mute"}
      </button>
      <button onClick={()=>void orderPopcorn()} disabled={popcorn!=="idle"||busy} className="flex min-h-10 items-center gap-2 rounded-xl bg-amber-300 px-3 text-xs font-black text-slate-950 shadow-xl disabled:opacity-70">
        <Popcorn className="h-4 w-4"/>{popcorn==="ordering"?"Buying…":popcorn==="eating"?"Eating 🍿":"Popcorn · "+(payload?.popcornCost??25)+" 🪙"}
      </button>
      <div className="grid grid-cols-2 gap-1.5">
        <button onClick={()=>switchStation(-1)} disabled={busy} className="min-h-10 rounded-xl bg-slate-950/90 px-2 text-xs font-black shadow-xl">◀ Prev</button>
        <button onClick={()=>switchStation(1)} disabled={busy} className="min-h-10 rounded-xl bg-slate-950/90 px-2 text-xs font-black shadow-xl">Next ▶</button>
      </div>
      <button onClick={()=>setPicker(true)} className="min-h-10 rounded-xl bg-fuchsia-600/90 px-3 text-xs font-black shadow-xl">
        📺 TV Guide
      </button>
    </div>

    <div className="pointer-events-none absolute left-1/2 top-14 z-20 max-w-[46vw] -translate-x-1/2 truncate rounded-full bg-black/55 px-3 py-1 text-[9px] font-black backdrop-blur sm:top-20 sm:text-[10px]">
      {notice}
    </div>

    <MobileMovePad onMove={move} className="bottom-24 left-3" label="Cinema movement controls"/>
    <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-xl bg-black/60 px-3 py-2 text-center text-[10px] font-bold text-white/70 backdrop-blur sm:text-xs">
      {seat?("Seated in "+seat+" · "):""}WASD/arrows walk · drag to look · tap a seat to sit {videoReady?"· show playing":""}
    </div>

    {picker&&payload&&<div className="absolute inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm">
      <section className="max-h-[88dvh] w-[min(620px,94vw)] overflow-auto rounded-[1.7rem] border border-white/10 bg-slate-950 p-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-fuchsia-300">A.R.I.S.E. Cinema TV</p>
            <h2 className="text-2xl font-black">Choose a channel or show</h2>
            <p className="mt-1 text-sm font-semibold text-white/55">Switching is free. The cinema screen changes for everyone currently watching.</p>
          </div>
          <button onClick={()=>setPicker(false)} className="grid h-10 w-10 place-items-center rounded-xl bg-white/10">×</button>
        </div>
        <div className="mt-4 space-y-5">
          {guideCategories.map(category=>{
            const shows=payload.movies.filter(movie=>(movie.category||"Open Movies")===category);
            if(!shows.length)return null;
            return <div key={category}>
              <div className="mb-2 flex items-center gap-2"><span className="text-xs font-black uppercase tracking-[.2em] text-amber-300">{category}</span><div className="h-px flex-1 bg-white/10"/></div>
              <div className="grid gap-2 sm:grid-cols-2">
                {shows.map(movie=><button
                  key={movie.id}
                  onClick={()=>void changeMovie(movie.id)}
                  disabled={busy||movie.id===payload.state.movieId}
                  className="min-h-[100px] w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-left hover:border-fuchsia-300/50 hover:bg-white/10 disabled:opacity-55"
                >
                  <div className="flex items-start gap-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10 text-2xl">{movie.emoji||"📺"}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-black leading-tight">{movie.title}</p>
                        {movie.id===payload.state.movieId&&<span className="shrink-0 rounded-full bg-cyan-300 px-2 py-1 text-[9px] font-black text-slate-950">PLAYING</span>}
                      </div>
                      <p className="mt-1 text-xs font-semibold text-white/55">{movie.subtitle}</p>
                      <p className="mt-2 text-[10px] font-bold text-amber-200/70">{movie.kind==="channel"?"Official YouTube channel":movie.license}</p>
                    </div>
                  </div>
                </button>)}
              </div>
            </div>
          })}
        </div>
      </section>
    </div>}
  </main>;
}
