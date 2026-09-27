import { useEffect, useRef, useState } from "react";

type Look={
  skin:string;
  hair:string;
  hairColor:string;
  eyeColor:string;
  face:string;
  build:string;
  brows:string;
};

type Props={
  look:Look;
  equipped:Record<string,string>;
  className?:string;
  compact?:boolean;
  initialView?:"full"|"face";
  controls?:boolean;
};

export default function ARISEAvatar3D({look,equipped,className="",compact=false,initialView="full",controls=true}:Props){
  const hostRef=useRef<HTMLDivElement|null>(null);
  const [view,setView]=useState<"full"|"face">(initialView);

  useEffect(()=>{
    const host=hostRef.current;
    if(!host)return;
    let disposed=false;
    let cleanup=()=>{};

    const boot=async()=>{
      const THREE:any=await import(/* @vite-ignore */ "https://esm.sh/three@0.180.0");
      if(disposed||!host)return;

      const canvasWrap=host.querySelector("[data-canvas-host]") as HTMLDivElement|null;
      if(!canvasWrap)return;
      canvasWrap.innerHTML="";

      const scene=new THREE.Scene();
      scene.background=new THREE.Color(0x08111f);
      scene.fog=new THREE.Fog(0x08111f,8,18);

      const camera=new THREE.PerspectiveCamera(view==="face"?27:31,1,.1,100);
      let cameraDistance=view==="face"?2.35:(compact?6.4:6.9);
      const targetY=view==="face"?3.92:2.18;
      camera.position.set(0,targetY+.02,cameraDistance);
      camera.lookAt(0,targetY,0);

      const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:"high-performance"});
      renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
      renderer.shadowMap.enabled=true;
      renderer.shadowMap.type=THREE.PCFSoftShadowMap;
      renderer.outputColorSpace=THREE.SRGBColorSpace;
      renderer.toneMapping=THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure=1.02;
      renderer.domElement.style.width="100%";
      renderer.domElement.style.height="100%";
      renderer.domElement.style.display="block";
      renderer.domElement.style.touchAction="none";
      renderer.domElement.style.cursor="grab";
      canvasWrap.appendChild(renderer.domElement);

      const hemi=new THREE.HemisphereLight(0xe8f4ff,0x10131a,1.75);
      scene.add(hemi);
      const key=new THREE.DirectionalLight(0xfff3e8,3.2);
      key.position.set(4.2,7.2,5.2);key.castShadow=true;key.shadow.mapSize.set(1024,1024);scene.add(key);
      const fill=new THREE.DirectionalLight(0xb8d7ff,1.65);
      fill.position.set(-3.4,4.4,4.0);scene.add(fill);
      const rim=new THREE.DirectionalLight(0x78d8ff,2.05);
      rim.position.set(-4.2,5.0,-4.0);scene.add(rim);

      const floorMat=new THREE.MeshStandardMaterial({color:0x111827,roughness:.6,metalness:.15});
      const floor=new THREE.Mesh(new THREE.CylinderGeometry(2.2,2.35,.14,64),floorMat);
      floor.position.y=.02;floor.receiveShadow=true;scene.add(floor);

      const avatar=new THREE.Group();
      scene.add(avatar);

      const physical=(color:string,rough=.58,metal=.01)=>new THREE.MeshPhysicalMaterial({
        color:new THREE.Color(color),roughness:rough,metalness:metal,clearcoat:.08,clearcoatRoughness:.75
      });
      const skin=physical(look.skin,.67,.0);
      const skinDark=new THREE.Color(look.skin).multiplyScalar(.78);
      const skinShadow=physical("#"+skinDark.getHexString(),.7,0);
      const hair=physical(look.hairColor,.86,0);
      const dark=physical("#10141d",.45,.1);
      const white=physical("#f7f5f0",.33,0);
      const iris=physical(look.eyeColor,.22,.0);
      const pupil=physical("#050607",.22,.0);
      const lipTone=new THREE.Color(look.skin).lerp(new THREE.Color("#8e4b4b"),.42);
      const lip=physical("#"+lipTone.getHexString(),.56,0);

      const shirtColor=equipped.top==="jacket-varsity"?"#0d766e":equipped.top==="hoodie-neon"?"#6530b8":equipped.top==="hoodie-midnight"?"#101827":"#0f766e";
      const pantsColor=equipped.bottom==="pants-cargo"?"#334155":"#172554";
      const shoeColor=equipped.shoes==="shoes-neon"?"#67e8f9":equipped.shoes==="shoes-white"?"#f4f5f7":"#dde3ea";
      const shirt=physical(shirtColor,.5,.02);
      const pants=physical(pantsColor,.6,.01);
      const shoes=physical(shoeColor,.36,.04);

      const buildScale=look.build==="slim"?{x:.90,shoulder:.91,limb:.94}:look.build==="broad"?{x:1.10,shoulder:1.12,limb:1.05}:{x:1,shoulder:1,limb:1};
      avatar.scale.x=buildScale.x;

      const mesh=(geo:any,material:any,x:number,y:number,z:number,rx=0,ry=0,rz=0,parent=avatar)=>{
        const m=new THREE.Mesh(geo,material);
        m.position.set(x,y,z);m.rotation.set(rx,ry,rz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
      };

      // Human body proportions
      mesh(new THREE.CapsuleGeometry(.25*buildScale.limb,1.08,10,24),pants,-.275,1.07,0);
      mesh(new THREE.CapsuleGeometry(.25*buildScale.limb,1.08,10,24),pants,.275,1.07,0);
      const leftShoe=mesh(new THREE.BoxGeometry(.50,.20,.78),shoes,-.275,.32,.18);
      const rightShoe=mesh(new THREE.BoxGeometry(.50,.20,.78),shoes,.275,.32,.18);
      leftShoe.rotation.x=-.03;rightShoe.rotation.x=-.03;

      const pelvis=mesh(new THREE.SphereGeometry(.54,32,20),pants,0,1.67,0);pelvis.scale.set(1,.62,.72);
      const torso=mesh(new THREE.SphereGeometry(.82,40,28),shirt,0,2.40,0);
      torso.scale.set(.96*buildScale.shoulder,1.08,.53);
      const chest=mesh(new THREE.SphereGeometry(.76,40,28),shirt,0,2.72,.02);chest.scale.set(1.06*buildScale.shoulder,.56,.55);

      // Arms taper toward wrists
      const upperArmL=mesh(new THREE.CapsuleGeometry(.18*buildScale.limb,.72,8,18),skin,-.82*buildScale.shoulder,2.55,0,0,0,.08);
      const upperArmR=mesh(new THREE.CapsuleGeometry(.18*buildScale.limb,.72,8,18),skin,.82*buildScale.shoulder,2.55,0,0,0,-.08);
      mesh(new THREE.CapsuleGeometry(.145*buildScale.limb,.62,8,18),skin,-.89*buildScale.shoulder,1.92,.02,0,0,.02);
      mesh(new THREE.CapsuleGeometry(.145*buildScale.limb,.62,8,18),skin,.89*buildScale.shoulder,1.92,.02,0,0,-.02);
      mesh(new THREE.SphereGeometry(.155,24,18),skin,-.90*buildScale.shoulder,1.49,.05);
      mesh(new THREE.SphereGeometry(.155,24,18),skin,.90*buildScale.shoulder,1.49,.05);

      // Sleeves
      const sleeveL=mesh(new THREE.CapsuleGeometry(.21,.34,8,16),shirt,-.79*buildScale.shoulder,2.80,0,0,0,.08);
      const sleeveR=mesh(new THREE.CapsuleGeometry(.21,.34,8,16),shirt,.79*buildScale.shoulder,2.80,0,0,0,-.08);

      // Neck + head structure
      mesh(new THREE.CylinderGeometry(.19,.225,.38,28),skin,0,3.28,0);

      const headGroup=new THREE.Group();
      headGroup.position.set(0,3.95,0);
      avatar.add(headGroup);

      // Main cranium
      const head=mesh(new THREE.SphereGeometry(.54,64,48),skin,0,.03,0,0,0,0,headGroup);
      const faceScale=look.face==="round"?[1.02,.98,.93]:look.face==="square"?[1.055,1.00,.91]:look.face==="long"?[.94,1.10,.92]:[.985,1.045,.92];
      head.scale.set(faceScale[0],faceScale[1],faceScale[2]);

      // Jaw / chin makes the face less spherical
      const jaw=mesh(new THREE.SphereGeometry(.44,56,40),skin,0,-.25,.035,0,0,0,headGroup);
      jaw.scale.set(look.face==="square"?1.04:.93,look.face==="long"?.72:.64,.87);
      const chin=mesh(new THREE.SphereGeometry(.15,32,22),skin,0,-.49,.32,0,0,0,headGroup);chin.scale.set(1.18,.70,.62);

      // Cheeks and temples
      const cheekL=mesh(new THREE.SphereGeometry(.17,32,22),skin,-.29,-.10,.39,0,0,0,headGroup);cheekL.scale.set(1.16,.70,.56);
      const cheekR=mesh(new THREE.SphereGeometry(.17,32,22),skin,.29,-.10,.39,0,0,0,headGroup);cheekR.scale.set(1.16,.70,.56);

      // Ears with small inner ear
      const earL=mesh(new THREE.SphereGeometry(.105,30,20),skin,-.535,.02,.01,0,0,0,headGroup);earL.scale.set(.58,1.12,.48);
      const earR=mesh(new THREE.SphereGeometry(.105,30,20),skin,.535,.02,.01,0,0,0,headGroup);earR.scale.set(.58,1.12,.48);
      mesh(new THREE.SphereGeometry(.042,20,14),skinShadow,-.552,.015,.045,0,0,0,headGroup).scale.set(.42,.86,.30);
      mesh(new THREE.SphereGeometry(.042,20,14),skinShadow,.552,.015,.045,0,0,0,headGroup).scale.set(.42,.86,.30);

      // Eyes are recessed slightly and shaped like human eyes
      const eyeY=.085,eyeZ=.488,eyeX=.205;
      const eyeL=mesh(new THREE.SphereGeometry(.078,32,22),white,-eyeX,eyeY,eyeZ,0,0,0,headGroup);eyeL.scale.set(1.42,.64,.55);
      const eyeR=mesh(new THREE.SphereGeometry(.078,32,22),white,eyeX,eyeY,eyeZ,0,0,0,headGroup);eyeR.scale.set(1.42,.64,.55);
      const irisL=mesh(new THREE.SphereGeometry(.043,28,18),iris,-eyeX,eyeY,.545,0,0,0,headGroup);irisL.scale.set(.82,.82,.28);
      const irisR=mesh(new THREE.SphereGeometry(.043,28,18),iris,eyeX,eyeY,.545,0,0,0,headGroup);irisR.scale.set(.82,.82,.28);
      mesh(new THREE.SphereGeometry(.020,24,16),pupil,-eyeX,eyeY,.570,0,0,0,headGroup).scale.set(.8,.8,.22);
      mesh(new THREE.SphereGeometry(.020,24,16),pupil,eyeX,eyeY,.570,0,0,0,headGroup).scale.set(.8,.8,.22);
      mesh(new THREE.SphereGeometry(.007,16,12),white,-eyeX-.009,eyeY+.012,.584,0,0,0,headGroup);
      mesh(new THREE.SphereGeometry(.007,16,12),white,eyeX-.009,eyeY+.012,.584,0,0,0,headGroup);

      // Upper/lower eyelids
      const lidMat=skin;
      const lidGeo=new THREE.TorusGeometry(.083,.010,8,30,Math.PI);
      const upperL=mesh(lidGeo,lidMat,-eyeX,eyeY+.025,.523,0,0,0,headGroup);upperL.scale.set(1.32,.62,1);
      const upperR=mesh(lidGeo,lidMat,eyeX,eyeY+.025,.523,0,0,0,headGroup);upperR.scale.set(1.32,.62,1);
      const lowerL=mesh(lidGeo,lidMat,-eyeX,eyeY-.030,.518,0,0,Math.PI,headGroup);lowerL.scale.set(1.24,.55,1);
      const lowerR=mesh(lidGeo,lidMat,eyeX,eyeY-.030,.518,0,0,Math.PI,headGroup);lowerR.scale.set(1.24,.55,1);

      // Brows follow a gentle human arch
      const browThickness=look.brows==="bold"?.030:.020;
      const browGeo=new THREE.CapsuleGeometry(browThickness,.19,6,12);
      const browL=mesh(browGeo,hair,-.205,.22,.505,0,0,look.brows==="straight"?Math.PI/2:1.47,headGroup);browL.scale.set(1,.75,.55);
      const browR=mesh(browGeo,hair,.205,.22,.505,0,0,look.brows==="straight"?Math.PI/2:1.67,headGroup);browR.scale.set(1,.75,.55);

      // Nose bridge, tip and nostrils
      const bridge=mesh(new THREE.CapsuleGeometry(.050,.22,8,16),skin,0,-.015,.515,Math.PI/2,0,0,headGroup);bridge.scale.set(.72,1,.56);
      const noseTip=mesh(new THREE.SphereGeometry(.080,32,22),skin,0,-.105,.585,0,0,0,headGroup);noseTip.scale.set(.92,.70,.78);
      const nostrilL=mesh(new THREE.SphereGeometry(.018,20,14),skinShadow,-.050,-.132,.640,0,0,0,headGroup);nostrilL.scale.set(1.15,.55,.34);
      const nostrilR=mesh(new THREE.SphereGeometry(.018,20,14),skinShadow,.050,-.132,.640,0,0,0,headGroup);nostrilR.scale.set(1.15,.55,.34);

      // Philtrum + two lips
      const philtrum=mesh(new THREE.CapsuleGeometry(.010,.040,5,10),skinShadow,0,-.205,.529,0,0,0,headGroup);philtrum.scale.set(.5,.62,.25);
      const upperLip=mesh(new THREE.CapsuleGeometry(.027,.145,6,18),lip,0,-.260,.532,0,0,Math.PI/2,headGroup);upperLip.scale.set(1,.72,.42);
      const lowerLip=mesh(new THREE.CapsuleGeometry(.031,.155,6,18),lip,0,-.305,.528,0,0,Math.PI/2,headGroup);lowerLip.scale.set(1,.78,.45);
      mesh(new THREE.CapsuleGeometry(.009,.132,5,12),skinShadow,0,-.282,.553,0,0,Math.PI/2,headGroup);

      // Hair
      if(look.hair==="afro"){
        const afro=mesh(new THREE.SphereGeometry(.68,48,34),hair,0,.40,-.03,0,0,0,headGroup);afro.scale.set(1.05,.80,.96);
      }else if(look.hair==="locs"){
        const cap=mesh(new THREE.SphereGeometry(.56,40,30),hair,0,.36,-.05,0,0,0,headGroup);cap.scale.set(1,.48,.95);
        for(let i=-4;i<=4;i++)mesh(new THREE.CapsuleGeometry(.037,.50,7,14),hair,i*.105,.16,.02,0,0,(i%2?-.045:.045),headGroup);
      }else if(look.hair==="braids"){
        const cap=mesh(new THREE.SphereGeometry(.57,40,30),hair,0,.36,-.05,0,0,0,headGroup);cap.scale.set(1,.44,.95);
        for(let i=-4;i<=4;i++)mesh(new THREE.CapsuleGeometry(.027,.58,7,14),hair,i*.105,.12,.025,0,0,(i%2?-.035:.035),headGroup);
      }else if(look.hair==="curls"){
        for(let y=0;y<3;y++)for(let x=-4;x<=4;x++){
          if(Math.abs(x)>3&&y===2)continue;
          mesh(new THREE.SphereGeometry(.105,20,16),hair,x*.11,.34+y*.085,-.015+(Math.abs(x)*.006),0,0,0,headGroup);
        }
      }else{
        const h=mesh(new THREE.SphereGeometry(.56,44,32),hair,0,.37,-.06,0,0,0,headGroup);
        h.scale.set(1,look.hair==="buzz"?.18:look.hair==="waves"?.27:look.hair==="short"?.31:.25,.95);
      }

      // Hats
      if(equipped.hat==="hat-cap"){
        mesh(new THREE.CylinderGeometry(.48,.53,.18,40),dark,0,.58,0,0,0,0,headGroup);
        mesh(new THREE.BoxGeometry(.46,.06,.33),dark,0,.53,.38,0,0,0,headGroup);
      }else if(equipped.hat==="hat-beanie"){
        const beanie=mesh(new THREE.SphereGeometry(.60,40,28),physical("#111827",.75,0),0,.52,-.03,0,0,0,headGroup);beanie.scale.set(1,.54,.96);
      }else if(equipped.hat==="hat-crown"){
        mesh(new THREE.CylinderGeometry(.38,.46,.34,8,1,true),physical("#fbbf24",.25,.70),0,.72,0,0,Math.PI/8,0,headGroup);
      }

      // Glasses
      if(equipped.glasses){
        const glassMat=new THREE.MeshPhysicalMaterial({color:equipped.glasses==="glasses-shades"?0x111827:0xa5efff,transparent:true,opacity:equipped.glasses==="glasses-shades"?.72:.28,roughness:.18,metalness:.12});
        const gL=mesh(new THREE.BoxGeometry(.245,.135,.025),glassMat,-eyeX,.085,.596,0,0,0,headGroup);
        const gR=mesh(new THREE.BoxGeometry(.245,.135,.025),glassMat,eyeX,.085,.596,0,0,0,headGroup);
        gL.scale.y=.82;gR.scale.y=.82;
        mesh(new THREE.BoxGeometry(.10,.020,.020),dark,0,.085,.596,0,0,0,headGroup);
      }

      // Accessories
      if(equipped.accessory==="chain-silver"){
        const chain=mesh(new THREE.TorusGeometry(.27,.019,10,50,Math.PI),physical("#d5d9df",.2,.82),0,3.12,.49,Math.PI/2,0,Math.PI);
        chain.scale.y=1.25;
      }
      if(equipped.accessory==="headphones-cyan"){
        mesh(new THREE.TorusGeometry(.50,.050,12,52,Math.PI),physical("#22d3ee",.25,.28),0,3.99,-.02,0,0,0);
        mesh(new THREE.BoxGeometry(.11,.25,.14),dark,-.49,3.91,.03);
        mesh(new THREE.BoxGeometry(.11,.25,.14),dark,.49,3.91,.03);
      }
      if(equipped.accessory==="watch-smart")mesh(new THREE.BoxGeometry(.11,.14,.09),dark,.96,1.91,.06,0,0,-.05);
      if(equipped.accessory==="bag-tech")mesh(new THREE.BoxGeometry(.70,.88,.28),physical("#111827",.55,.06),0,2.36,-.48);

      mesh(new THREE.CircleGeometry(.105,30),physical("#e6edf5",.3,.04),0,2.72,.455);

      let dragging=false,lastX=0,yaw=0;
      const down=(e:PointerEvent)=>{dragging=true;lastX=e.clientX;renderer.domElement.style.cursor="grabbing";renderer.domElement.setPointerCapture?.(e.pointerId);};
      const move=(e:PointerEvent)=>{if(!dragging)return;const dx=e.clientX-lastX;lastX=e.clientX;yaw+=dx*.0105;};
      const stop=()=>{dragging=false;renderer.domElement.style.cursor="grab";};
      const wheel=(e:WheelEvent)=>{
        e.preventDefault();
        const min=view==="face"?1.75:5.1;
        const max=view==="face"?3.25:8.4;
        cameraDistance=Math.min(max,Math.max(min,cameraDistance+e.deltaY*.003));
      };
      renderer.domElement.addEventListener("pointerdown",down);
      renderer.domElement.addEventListener("pointermove",move);
      renderer.domElement.addEventListener("pointerup",stop);
      renderer.domElement.addEventListener("pointercancel",stop);
      renderer.domElement.addEventListener("wheel",wheel,{passive:false});

      let pinchDistance=0;
      const touchStart=(e:TouchEvent)=>{
        if(e.touches.length===2)pinchDistance=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
      };
      const touchMove=(e:TouchEvent)=>{
        if(e.touches.length!==2)return;
        e.preventDefault();
        const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
        if(pinchDistance){
          const min=view==="face"?1.75:5.1,max=view==="face"?3.25:8.4;
          cameraDistance=Math.min(max,Math.max(min,cameraDistance+(pinchDistance-d)*.008));
        }
        pinchDistance=d;
      };
      renderer.domElement.addEventListener("touchstart",touchStart,{passive:false});
      renderer.domElement.addEventListener("touchmove",touchMove,{passive:false});

      const resize=()=>{
        const w=Math.max(1,canvasWrap.clientWidth),h=Math.max(1,canvasWrap.clientHeight);
        renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
      };
      const ro=new ResizeObserver(resize);ro.observe(canvasWrap);resize();

      const clock=new THREE.Clock();
      let frame=0;
      const loop=()=>{
        if(disposed)return;
        const t=clock.getElapsedTime();
        avatar.rotation.y=yaw+Math.sin(t*.45)*.022;
        avatar.position.y=Math.sin(t*1.2)*.008;
        torso.rotation.z=Math.sin(t*.8)*.003;
        upperArmL.rotation.z=.08+Math.sin(t*.8)*.005;
        upperArmR.rotation.z=-.08-Math.sin(t*.8)*.005;
        camera.position.z+=(cameraDistance-camera.position.z)*.14;
        camera.lookAt(0,targetY,0);
        renderer.render(scene,camera);
        frame=requestAnimationFrame(loop);
      };
      loop();

      cleanup=()=>{
        cancelAnimationFrame(frame);ro.disconnect();
        renderer.domElement.removeEventListener("pointerdown",down);
        renderer.domElement.removeEventListener("pointermove",move);
        renderer.domElement.removeEventListener("pointerup",stop);
        renderer.domElement.removeEventListener("pointercancel",stop);
        renderer.domElement.removeEventListener("wheel",wheel);
        renderer.domElement.removeEventListener("touchstart",touchStart);
        renderer.domElement.removeEventListener("touchmove",touchMove);
        renderer.dispose();
        scene.traverse((o:any)=>{
          o.geometry?.dispose?.();
          if(Array.isArray(o.material))o.material.forEach((m:any)=>m.dispose?.()); else o.material?.dispose?.();
        });
        if(canvasWrap.contains(renderer.domElement))canvasWrap.removeChild(renderer.domElement);
      };
    };

    void boot();
    return()=>{disposed=true;cleanup();};
  },[look.skin,look.hair,look.hairColor,look.eyeColor,look.face,look.build,look.brows,equipped.top,equipped.bottom,equipped.shoes,equipped.hat,equipped.glasses,equipped.accessory,compact,view]);

  return <div ref={hostRef} className={"relative overflow-hidden "+className} aria-label="Interactive A.R.I.S.E. 3D character">
    <div data-canvas-host className="absolute inset-0"/>
    {controls&&<div className="absolute left-3 top-3 z-10 flex gap-2 rounded-2xl bg-slate-950/70 backdrop-blur p-1.5 border border-white/10">
      <button type="button" onClick={()=>setView("full")} className={"rounded-xl px-3 py-2 text-xs font-black "+(view==="full"?"bg-white text-slate-950":"text-white/70")}>FULL BODY</button>
      <button type="button" onClick={()=>setView("face")} className={"rounded-xl px-3 py-2 text-xs font-black "+(view==="face"?"bg-white text-slate-950":"text-white/70")}>FACE</button>
    </div>}
    {controls&&<div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 rounded-full bg-slate-950/65 backdrop-blur px-4 py-2 text-[11px] font-black text-white/70 border border-white/10 whitespace-nowrap">
      Drag to rotate · Scroll/pinch to zoom
    </div>}
  </div>;
}
