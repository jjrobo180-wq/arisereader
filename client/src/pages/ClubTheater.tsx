import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { ArrowLeft, Coins, Popcorn, Users, Volume2, VolumeX } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";
import { getAvatarCharacter } from "@/lib/avatarCharacters";

type Movie={id:string;title:string;subtitle:string;youtubeId:string;duration:number;license:string;attribution:string;age:string};
type TheaterVisitor={userId:number;displayName:string;characterId:string;x:number;z:number;facing:number;seatId:string|null};
type TheaterPayload={state:{movieId:string;positionSeconds:number;startedAt:number;playing:boolean;currentPosition:number;audience:number;players:TheaterVisitor[]};movies:Movie[];changeCost:number;wallet:number};
type ClubSelf={userId:number;displayName:string;characterId:string};

const SEATS=Array.from({length:12},(_,i)=>({id:"S"+(i+1),row:Math.floor(i/4),col:i%4}));

export default function ClubTheater(){
  const {token}=useAuth();
  const [,navigate]=useLocation();
  const mountRef=useRef<HTMLDivElement>(null);
  const youtubeRef=useRef<HTMLIFrameElement|null>(null);
  const rootRef=useRef<THREE.Group|null>(null);
  const cameraRef=useRef<THREE.PerspectiveCamera|null>(null);
  const controlsRef=useRef<OrbitControls|null>(null);
  const sceneRef=useRef<THREE.Scene|null>(null);
  const remoteRootsRef=useRef<Map<number,THREE.Group>>(new Map());
  const targetRef=useRef(new THREE.Vector3(0,0,21));
  const seatRef=useRef<string|null>(null);
  const keysRef=useRef(new Set<string>());
  const [payload,setPayload]=useState<TheaterPayload|null>(null);
  const [self,setSelf]=useState<ClubSelf|null>(null);
  const [muted,setMuted]=useState(true);
  const [seat,setSeat]=useState<string|null>(null);
  const [popcorn,setPopcorn]=useState<"idle"|"ordering"|"ready">("idle");
  const [picker,setPicker]=useState(false);
  const [busy,setBusy]=useState(false);
  const [videoReady,setVideoReady]=useState(false);
  const [embedStart,setEmbedStart]=useState(0);
  const [notice,setNotice]=useState("Explore the lobby, grab popcorn, meet readers, or walk into the auditorium.");
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
    const mount=mountRef.current;
    if(!mount)return;
    let disposed=false;
    const scene=new THREE.Scene();
    sceneRef.current=scene;
    scene.background=new THREE.Color(0x05030a);
    scene.fog=new THREE.Fog(0x05030a,26,55);

    const camera=new THREE.PerspectiveCamera(52,mount.clientWidth/Math.max(1,mount.clientHeight),.1,100);
    camera.position.set(0,8.5,31);
    cameraRef.current=camera;

    const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance"});
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));
    renderer.setSize(mount.clientWidth,mount.clientHeight);
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.shadowMap.enabled=true;
    mount.appendChild(renderer.domElement);

    const controls=new OrbitControls(camera,renderer.domElement);
    controlsRef.current=controls;
    controls.target.set(0,1.5,20);
    controls.enableDamping=true;
    controls.minDistance=6;
    controls.maxDistance=38;
    controls.maxPolarAngle=Math.PI/2.05;

    scene.add(new THREE.HemisphereLight(0x9ecfff,0x180710,1.5));
    const screenGlow=new THREE.PointLight(0x72d7ff,5.5,28);
    screenGlow.position.set(0,5,-8);
    scene.add(screenGlow);

    const floor=new THREE.Mesh(
      new THREE.PlaneGeometry(30,58),
      new THREE.MeshStandardMaterial({color:0x170b18,roughness:.9})
    );
    floor.rotation.x=-Math.PI/2;
    floor.position.z=9;
    floor.receiveShadow=true;
    floor.userData.ground=true;
    scene.add(floor);

    const back=new THREE.Mesh(new THREE.BoxGeometry(28,11,.7),new THREE.MeshStandardMaterial({color:0x100811}));
    back.position.set(0,5.5,-10);
    scene.add(back);

    for(const x of [-14,14]){
      const wall=new THREE.Mesh(new THREE.BoxGeometry(.7,11,58),new THREE.MeshStandardMaterial({color:0x120914}));
      wall.position.set(x,5.5,9);
      scene.add(wall);
    }

    const frame=new THREE.Mesh(
      new THREE.BoxGeometry(16.5,9,.5),
      new THREE.MeshStandardMaterial({color:0x08080d,metalness:.55,roughness:.25})
    );
    frame.position.set(0,5.4,-9.35);
    scene.add(frame);

    const fakeScreen=new THREE.Mesh(
      new THREE.PlaneGeometry(15.4,7.9),
      new THREE.MeshBasicMaterial({color:0x111827})
    );
    fakeScreen.position.set(0,5.4,-9.02);
    scene.add(fakeScreen);

    const aisle=new THREE.Mesh(
      new THREE.PlaneGeometry(2.7,31),
      new THREE.MeshStandardMaterial({color:0x3b0a16,roughness:.8,emissive:0x2c0710,emissiveIntensity:.18})
    );
    aisle.rotation.x=-Math.PI/2;
    aisle.position.set(0,.02,6);
    scene.add(aisle);

    for(const x of [-11.5,11.5]){
      for(const z of [-5,2,9,16]){
        const lamp=new THREE.PointLight(0xf59e0b,1.2,5);
        lamp.position.set(x,2.5,z);
        scene.add(lamp);
      }
    }

    const rayTargets:THREE.Object3D[]=[floor];
    SEATS.forEach(s=>{
      const x=(s.col-1.5)*3.2+(s.col<2?-1.25:1.25);
      const z=2+s.row*3.7;
      const root=new THREE.Group();
      root.position.set(x,0,z);
      root.userData.seatId=s.id;
      scene.add(root);

      const seatMat=new THREE.MeshStandardMaterial({color:0x991b1b,roughness:.5});
      const cushion=new THREE.Mesh(new THREE.BoxGeometry(2.1,.45,1.75),seatMat);
      cushion.position.y=.55;
      cushion.castShadow=true;
      root.add(cushion);

      const backrest=new THREE.Mesh(new THREE.BoxGeometry(2.1,2.05,.4),seatMat);
      backrest.position.set(0,1.55,.65);
      backrest.rotation.x=-.08;
      backrest.castShadow=true;
      root.add(backrest);

      const armMat=new THREE.MeshStandardMaterial({color:0x111827,metalness:.2,roughness:.5});
      for(const ax of [-1.2,1.2]){
        const arm=new THREE.Mesh(new THREE.BoxGeometry(.18,.58,1.6),armMat);
        arm.position.set(ax,.75,0);
        root.add(arm);
      }

      const hit=new THREE.Mesh(
        new THREE.BoxGeometry(2.6,2.8,2.3),
        new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false})
      );
      hit.position.y=1.25;
      hit.userData.seatId=s.id;
      root.add(hit);
      rayTargets.push(hit);

      const cup=new THREE.Mesh(new THREE.CylinderGeometry(.16,.13,.42,12),new THREE.MeshStandardMaterial({color:0xef4444}));
      cup.position.set(1.25,.95,.1);
      root.add(cup);
    });

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
    const lobbyGlow=new THREE.PointLight(0xf59e0b,3,16);lobbyGlow.position.set(0,6,22);scene.add(lobbyGlow);

    const avatarRoot=new THREE.Group();
    avatarRoot.position.set(0,0,25);
    scene.add(avatarRoot);
    rootRef.current=avatarRoot;
    targetRef.current.copy(avatarRoot.position);

    if(self){
      const loader=new GLTFLoader();
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
    const pointer=new THREE.Vector2();
    const click=(e:PointerEvent)=>{
      const rect=renderer.domElement.getBoundingClientRect();
      pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
      ray.setFromCamera(pointer,camera);
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
              targetRef.current.set(sx,0,sz+.15);
              setSeat(seatId);
              setNotice("Walking to seat "+seatId+"…");
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
          THREE.MathUtils.clamp(hit.point.z,-7,27)
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
    };
    window.addEventListener("resize",resize);

    const clock=new THREE.Clock();
    let raf=0;
    const loop=()=>{
      const dt=Math.min(.04,clock.getDelta());
      const root=rootRef.current;
      if(root){
        (root.userData.mixer as THREE.AnimationMixer|undefined)?.update(dt);

        const dir=new THREE.Vector3(
          ((keysRef.current.has("d")||keysRef.current.has("arrowright"))?1:0)-((keysRef.current.has("a")||keysRef.current.has("arrowleft"))?1:0),
          0,
          ((keysRef.current.has("s")||keysRef.current.has("arrowdown"))?1:0)-((keysRef.current.has("w")||keysRef.current.has("arrowup"))?1:0)
        );

        if(dir.lengthSq()>0){
          dir.normalize().multiplyScalar(6*dt);
          targetRef.current.copy(root.position.clone().add(dir));
          setSeat(null);
        }

        const delta=targetRef.current.clone().sub(root.position);
        delta.y=0;
        if(delta.length()>.1){
          root.position.y=0;
          const step=Math.min(delta.length(),5.8*dt);
          const move=delta.normalize().multiplyScalar(step);
          root.position.add(move);
          root.position.x=THREE.MathUtils.clamp(root.position.x,-12,12);
          root.position.z=THREE.MathUtils.clamp(root.position.z,-7,27);
          root.rotation.y=Math.atan2(move.x,move.z);
        }else if(seatRef.current){
          root.position.y=.42;
          root.rotation.y=Math.PI;
        }else root.position.y=0;

        const center=new THREE.Vector3(root.position.x,1.5,root.position.z);
        camera.position.add(center.clone().sub(controls.target));
        controls.target.lerp(center,.15);
      }
      controls.update();
      renderer.render(scene,camera);
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
      sceneRef.current=null;remoteRootsRef.current.clear();
      scene.traverse(o=>{
        const m=o as THREE.Mesh;
        m.geometry?.dispose();
        if(m.material)(Array.isArray(m.material)?m.material:[m.material]).forEach(x=>x.dispose());
      });
      renderer.dispose();
      if(mount.contains(renderer.domElement))mount.removeChild(renderer.domElement);
    };
  },[self?.characterId]);

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
        remoteRootsRef.current.set(player.userId,root);
      }
      root.userData.mixer?.update?.(.04);
      root.position.lerp(new THREE.Vector3(player.x,player.seatId?.startsWith("S") ? .42 : 0,player.z),.28);
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

  const orderPopcorn=()=>{
    if(popcorn!=="idle")return;
    setPopcorn("ordering");
    setNotice("Popcorn is popping…");
    window.setTimeout(()=>{
      setPopcorn("ready");
      setNotice("🍿 Your popcorn is ready!");
    },1800);
  };

  return <main className="relative h-[100dvh] overflow-hidden bg-black text-white">
    <div ref={mountRef} className="absolute inset-0 touch-none"/>

    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center gap-2 bg-gradient-to-b from-black/90 to-transparent p-2 sm:p-4">
      <button onClick={()=>navigate("/club-arise")} className="pointer-events-auto flex min-h-11 items-center gap-2 rounded-xl bg-black/70 px-3 font-black backdrop-blur">
        <ArrowLeft className="h-4 w-4"/><span className="hidden sm:inline">Back to Club</span>
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-black uppercase tracking-[.22em] text-amber-300">Club A.R.I.S.E.</p>
        <h1 className="truncate text-lg font-black sm:text-2xl">🎬 Cinema Room</h1>
      </div>
      <div className="pointer-events-auto flex items-center gap-1.5 rounded-xl border border-amber-300/25 bg-black/70 px-2.5 py-2 text-sm font-black">
        <Coins className="h-4 w-4 text-amber-300"/>{payload?.wallet?.toLocaleString()??"—"}
      </div>
    </header>

    <div className="pointer-events-none absolute left-1/2 top-[10%] z-20 w-[min(700px,58vw)] -translate-x-1/2 sm:w-[min(720px,48vw)]">
      <div className="overflow-hidden rounded-md border-[3px] border-black bg-black shadow-[0_0_45px_rgba(56,189,248,.24)]">
        {currentMovie&&<iframe
          ref={youtubeRef}
          key={currentMovie.id+"-"+embedStart}
          src={"https://www.youtube-nocookie.com/embed/"+currentMovie.youtubeId+"?autoplay=1&mute=1&playsinline=1&controls=0&rel=0&modestbranding=1&enablejsapi=1&start="+embedStart}
          title={currentMovie.title}
          allow="autoplay; encrypted-media; picture-in-picture"
          onLoad={()=>{setVideoReady(true);youtubeCommand("playVideo");if(muted)youtubeCommand("mute");}}
          className="aspect-video w-full bg-black"
        />}
      </div>
      <div className="mx-auto mt-1 w-fit rounded-full bg-black/55 px-3 py-1 text-center backdrop-blur">
        <p className="text-[9px] font-black sm:text-[10px]">{currentMovie?.title||"Loading show…"} · {payload?.state.audience||0} watching</p>
      </div>
    </div>

    <div className="absolute right-2 top-16 z-30 flex flex-col gap-1.5 sm:right-4 sm:top-24">
      <button type="button" onClick={()=>setMuted(value=>!value)} className="flex min-h-10 items-center gap-2 rounded-xl bg-slate-950/90 px-3 text-xs font-black shadow-xl backdrop-blur">
        {muted?<VolumeX className="h-4 w-4"/>:<Volume2 className="h-4 w-4"/>}{muted?"Hear Movie":"Mute"}
      </button>
      <button onClick={orderPopcorn} disabled={popcorn!=="idle"} className="flex min-h-10 items-center gap-2 rounded-xl bg-amber-300 px-3 text-xs font-black text-slate-950 shadow-xl disabled:opacity-70">
        <Popcorn className="h-4 w-4"/>{popcorn==="ordering"?"Popping…":popcorn==="ready"?"🍿 Ready":"Popcorn"}
      </button>
      <button onClick={()=>setPicker(true)} className="min-h-10 rounded-xl bg-fuchsia-600/90 px-3 text-xs font-black shadow-xl">
        Change Movie
      </button>
    </div>

    <div className="pointer-events-none absolute left-1/2 top-14 z-20 max-w-[46vw] -translate-x-1/2 truncate rounded-full bg-black/55 px-3 py-1 text-[9px] font-black backdrop-blur sm:top-20 sm:text-[10px]">
      {notice}
    </div>

    <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-xl bg-black/60 px-3 py-2 text-center text-[10px] font-bold text-white/70 backdrop-blur sm:text-xs">
      {seat?("Seated in "+seat+" · "):""}Walk the lobby or auditorium · tap a seat to sit · WASD/arrows {videoReady?"· show playing":""}
    </div>

    {picker&&payload&&<div className="absolute inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm">
      <section className="max-h-[88dvh] w-[min(620px,94vw)] overflow-auto rounded-[1.7rem] border border-white/10 bg-slate-950 p-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-fuchsia-300">Theater channel</p>
            <h2 className="text-2xl font-black">Choose the next movie</h2>
            <p className="mt-1 text-sm font-semibold text-white/55">Changing it costs {payload.changeCost} Reader Coins and changes the shared screening for everyone.</p>
          </div>
          <button onClick={()=>setPicker(false)} className="grid h-10 w-10 place-items-center rounded-xl bg-white/10">×</button>
        </div>
        <div className="mt-4 space-y-2">
          {payload.movies.map(movie=><button
            key={movie.id}
            onClick={()=>void changeMovie(movie.id)}
            disabled={busy||movie.id===payload.state.movieId}
            className="w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-left hover:bg-white/10 disabled:opacity-45"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-black">{movie.title}</p>
                <p className="text-xs font-semibold text-white/55">{movie.subtitle} · {movie.age}</p>
              </div>
              {movie.id===payload.state.movieId&&<span className="rounded-full bg-cyan-300 px-2 py-1 text-[9px] font-black text-slate-950">PLAYING</span>}
            </div>
            <p className="mt-2 text-[10px] font-bold text-amber-200/75">{movie.license} · {movie.attribution}</p>
          </button>)}
        </div>
      </section>
    </div>}
  </main>;
}
