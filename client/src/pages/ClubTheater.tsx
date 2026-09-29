import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { ArrowLeft, Coins, Popcorn, Volume2, VolumeX } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";
import { getAvatarCharacter } from "@/lib/avatarCharacters";

type Movie={id:string;title:string;subtitle:string;youtubeId:string;duration:number;license:string;attribution:string;age:string};
type TheaterPayload={state:{movieId:string;positionSeconds:number;startedAt:number;playing:boolean;currentPosition:number;audience:number};movies:Movie[];changeCost:number;wallet:number};
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
  const targetRef=useRef(new THREE.Vector3(0,0,15));
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
  const [notice,setNotice]=useState("Walk around the theater, tap a seat, and enjoy the show.");
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
  useEffect(()=>{
    if(!token)return;
    const timer=window.setInterval(()=>void load(),5000);
    return()=>window.clearInterval(timer);
  },[token]);

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
    scene.background=new THREE.Color(0x05030a);
    scene.fog=new THREE.Fog(0x05030a,26,55);

    const camera=new THREE.PerspectiveCamera(52,mount.clientWidth/Math.max(1,mount.clientHeight),.1,100);
    camera.position.set(0,7.5,23);
    cameraRef.current=camera;

    const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance"});
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));
    renderer.setSize(mount.clientWidth,mount.clientHeight);
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.shadowMap.enabled=true;
    mount.appendChild(renderer.domElement);

    const controls=new OrbitControls(camera,renderer.domElement);
    controlsRef.current=controls;
    controls.target.set(0,1.5,12);
    controls.enableDamping=true;
    controls.minDistance=6;
    controls.maxDistance=28;
    controls.maxPolarAngle=Math.PI/2.05;

    scene.add(new THREE.HemisphereLight(0x9ecfff,0x180710,1.5));
    const screenGlow=new THREE.PointLight(0x72d7ff,5.5,28);
    screenGlow.position.set(0,5,-8);
    scene.add(screenGlow);

    const floor=new THREE.Mesh(
      new THREE.PlaneGeometry(28,42),
      new THREE.MeshStandardMaterial({color:0x170b18,roughness:.9})
    );
    floor.rotation.x=-Math.PI/2;
    floor.position.z=5;
    floor.receiveShadow=true;
    floor.userData.ground=true;
    scene.add(floor);

    const back=new THREE.Mesh(new THREE.BoxGeometry(28,11,.7),new THREE.MeshStandardMaterial({color:0x100811}));
    back.position.set(0,5.5,-10);
    scene.add(back);

    for(const x of [-14,14]){
      const wall=new THREE.Mesh(new THREE.BoxGeometry(.7,11,42),new THREE.MeshStandardMaterial({color:0x120914}));
      wall.position.set(x,5.5,5);
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

    const counter=new THREE.Mesh(new THREE.BoxGeometry(6.4,1.2,2.2),new THREE.MeshStandardMaterial({color:0x78350f,roughness:.65}));
    counter.position.set(-9.5,.6,15.5);
    scene.add(counter);

    const sign=new THREE.Mesh(new THREE.BoxGeometry(4.5,.8,.22),new THREE.MeshStandardMaterial({color:0xfacc15,emissive:0xf59e0b,emissiveIntensity:.8}));
    sign.position.set(-9.5,3.5,14.8);
    scene.add(sign);

    const avatarRoot=new THREE.Group();
    avatarRoot.position.set(0,0,18);
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
          THREE.MathUtils.clamp(hit.point.z,-7,19)
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
          const step=Math.min(delta.length(),5.8*dt);
          const move=delta.normalize().multiplyScalar(step);
          root.position.add(move);
          root.position.x=THREE.MathUtils.clamp(root.position.x,-12,12);
          root.position.z=THREE.MathUtils.clamp(root.position.z,-7,19);
          root.rotation.y=Math.atan2(move.x,move.z);
        }

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
      scene.traverse(o=>{
        const m=o as THREE.Mesh;
        m.geometry?.dispose();
        if(m.material)(Array.isArray(m.material)?m.material:[m.material]).forEach(x=>x.dispose());
      });
      renderer.dispose();
      if(mount.contains(renderer.domElement))mount.removeChild(renderer.domElement);
    };
  },[self?.characterId]);

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

    <div className="absolute left-1/2 top-[12%] z-20 w-[min(760px,72vw)] -translate-x-1/2">
      <div className="overflow-hidden rounded-[1.2rem] border-4 border-slate-950 bg-black shadow-[0_0_70px_rgba(56,189,248,.28)]">
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
      <div className="mt-1 rounded-xl bg-black/70 px-3 py-2 text-center backdrop-blur">
        <p className="truncate text-xs font-black sm:text-sm">{currentMovie?.title||"Loading show…"}</p>
        <p className="truncate text-[9px] font-bold text-white/50">{payload?.state.audience||0} in theater · {payload?.state.playing?"channel playing":"channel paused"}</p>
      </div>
    </div>

    <div className="absolute right-2 top-16 z-30 flex flex-col gap-2 sm:right-4 sm:top-24">
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

    <div className="pointer-events-none absolute left-1/2 top-14 z-20 max-w-[56vw] -translate-x-1/2 truncate rounded-full bg-black/65 px-3 py-1.5 text-[10px] font-black backdrop-blur sm:top-20 sm:text-xs">
      {notice}
    </div>

    <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-xl bg-black/60 px-3 py-2 text-center text-[10px] font-bold text-white/70 backdrop-blur sm:text-xs">
      {seat?("Seat "+seat+" selected · "):""}Tap floor to walk · tap a seat to sit · WASD/arrows {videoReady?"· movie playing":""}
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
