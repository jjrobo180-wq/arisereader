import { useEffect, useRef } from "react";

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
};

export default function ARISEAvatar3D({look,equipped,className="",compact=false}:Props){
  const hostRef=useRef<HTMLDivElement|null>(null);

  useEffect(()=>{
    const host=hostRef.current;
    if(!host)return;
    let disposed=false;
    let cleanup=()=>{};

    const boot=async()=>{
      const THREE:any=await import(/* @vite-ignore */ "https://esm.sh/three@0.180.0");
      if(disposed||!host)return;

      host.innerHTML="";
      const scene=new THREE.Scene();
      scene.background=new THREE.Color(0x07111f);
      scene.fog=new THREE.Fog(0x07111f,7,16);

      const camera=new THREE.PerspectiveCamera(34,1,.1,100);
      camera.position.set(0,compact?2.15:2.35,compact?6.1:6.5);
      camera.lookAt(0,2.05,0);

      const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:"high-performance"});
      renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
      renderer.shadowMap.enabled=true;
      renderer.shadowMap.type=THREE.PCFSoftShadowMap;
      renderer.outputColorSpace=THREE.SRGBColorSpace;
      renderer.toneMapping=THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure=1.08;
      renderer.domElement.style.width="100%";
      renderer.domElement.style.height="100%";
      renderer.domElement.style.display="block";
      renderer.domElement.style.touchAction="none";
      host.appendChild(renderer.domElement);

      const hemi=new THREE.HemisphereLight(0xdff6ff,0x111827,2.1);
      scene.add(hemi);
      const key=new THREE.DirectionalLight(0xffffff,3.7);
      key.position.set(4,7,5);
      key.castShadow=true;
      key.shadow.mapSize.set(1024,1024);
      scene.add(key);
      const rim=new THREE.DirectionalLight(0x55d6ff,2.6);
      rim.position.set(-4,4,-4);
      scene.add(rim);
      const fill=new THREE.PointLight(0x8b5cf6,1.7,12);
      fill.position.set(-3,3.5,3);
      scene.add(fill);

      const floorMat=new THREE.MeshStandardMaterial({color:0x111827,roughness:.62,metalness:.18});
      const floor=new THREE.Mesh(new THREE.CylinderGeometry(2.15,2.35,.16,64),floorMat);
      floor.position.y=.02;
      floor.receiveShadow=true;
      scene.add(floor);

      const avatar=new THREE.Group();
      scene.add(avatar);

      const mat=(color:string,rough=.55,metal=.02)=>new THREE.MeshPhysicalMaterial({
        color:new THREE.Color(color),roughness:rough,metalness:metal,clearcoat:.18,clearcoatRoughness:.7
      });
      const skin=mat(look.skin,.64,.01);
      const hair=mat(look.hairColor,.82,.01);
      const dark=mat("#111827",.48,.14);
      const shirtColor=equipped.top==="jacket-varsity"?"#0f766e":equipped.top==="hoodie-neon"?"#6d28d9":equipped.top==="hoodie-midnight"?"#111827":"#0f766e";
      const pantsColor=equipped.bottom==="pants-cargo"?"#334155":"#172554";
      const shoeColor=equipped.shoes==="shoes-neon"?"#67e8f9":equipped.shoes==="shoes-white"?"#f8fafc":"#e2e8f0";
      const shirt=mat(shirtColor,.46,.04);
      const pants=mat(pantsColor,.58,.02);
      const shoes=mat(shoeColor,.32,.05);
      const white=mat("#f8fafc",.35,.02);
      const eyeMat=mat(look.eyeColor,.25,.02);
      const lip=mat("#8b4f4f",.5,0);

      const buildScale=look.build==="slim"?{x:.88,shoulder:.88}:look.build==="broad"?{x:1.13,shoulder:1.13}:{x:1,shoulder:1};
      avatar.scale.x=buildScale.x;

      const mesh=(geo:any,material:any,x:number,y:number,z:number,rx=0,ry=0,rz=0)=>{
        const m=new THREE.Mesh(geo,material);
        m.position.set(x,y,z);m.rotation.set(rx,ry,rz);m.castShadow=true;m.receiveShadow=true;avatar.add(m);return m;
      };

      // Legs
      mesh(new THREE.CapsuleGeometry(.26,.95,8,18),pants,-.28,1.05,0);
      mesh(new THREE.CapsuleGeometry(.26,.95,8,18),pants,.28,1.05,0);
      // Shoes
      const leftShoe=mesh(new THREE.RoundedBoxGeometry?.(.52,.22,.85,4,.08) || new THREE.BoxGeometry(.52,.22,.85),shoes,-.28,.35,.16);
      const rightShoe=mesh(new THREE.RoundedBoxGeometry?.(.52,.22,.85,4,.08) || new THREE.BoxGeometry(.52,.22,.85),shoes,.28,.35,.16);
      leftShoe.rotation.x=-.02;rightShoe.rotation.x=-.02;

      // Torso
      const torso=mesh(new THREE.CapsuleGeometry(.66,1.12,10,24),shirt,0,2.35,0,0,0,0);
      torso.scale.set(1.05*buildScale.shoulder,1,0.72);

      // Arms
      mesh(new THREE.CapsuleGeometry(.20,1.05,8,18),skin,-.83*buildScale.shoulder,2.35,0,0,0,.08);
      mesh(new THREE.CapsuleGeometry(.20,1.05,8,18),skin,.83*buildScale.shoulder,2.35,0,0,0,-.08);

      // Short sleeves / jacket upper arms
      const sleeveL=mesh(new THREE.CapsuleGeometry(.235,.46,8,18),shirt,-.80*buildScale.shoulder,2.72,0,0,0,.09);
      const sleeveR=mesh(new THREE.CapsuleGeometry(.235,.46,8,18),shirt,.80*buildScale.shoulder,2.72,0,0,0,-.09);
      sleeveL.scale.y=.8;sleeveR.scale.y=.8;

      // Neck
      mesh(new THREE.CylinderGeometry(.20,.23,.38,24),skin,0,3.19,0);

      // Head - subtly vary by face shape
      const head=mesh(new THREE.SphereGeometry(.57,48,32),skin,0,3.88,0);
      const faceScale=look.face==="round"?[1.03,.96,.98]:look.face==="square"?[1.06,1,.94]:look.face==="long"?[.94,1.1,.96]:[1,1.03,.98];
      head.scale.set(faceScale[0],faceScale[1],faceScale[2]);

      // Ears
      mesh(new THREE.SphereGeometry(.105,24,16),skin,-.56,3.88,0);
      mesh(new THREE.SphereGeometry(.105,24,16),skin,.56,3.88,0);

      // Eyes
      mesh(new THREE.SphereGeometry(.073,28,18),white,-.20,3.96,.505);
      mesh(new THREE.SphereGeometry(.073,28,18),white,.20,3.96,.505);
      mesh(new THREE.SphereGeometry(.035,24,16),eyeMat,-.20,3.96,.568);
      mesh(new THREE.SphereGeometry(.035,24,16),eyeMat,.20,3.96,.568);
      mesh(new THREE.SphereGeometry(.013,18,12),dark,-.20,3.96,.596);
      mesh(new THREE.SphereGeometry(.013,18,12),dark,.20,3.96,.596);

      // Brows
      const browGeo=new THREE.BoxGeometry(look.brows==="bold"?.18:.16,look.brows==="bold"?.035:.024,.025);
      const browL=mesh(browGeo,hair,-.20,4.12,.558,0,0,look.brows==="straight"?0:.08);
      const browR=mesh(browGeo,hair,.20,4.12,.558,0,0,look.brows==="straight"?0:-.08);

      // Nose + mouth
      const nose=mesh(new THREE.ConeGeometry(.065,.20,24),skin,0,3.84,.575,Math.PI/2,0,0);
      nose.scale.z=.62;
      const mouth=mesh(new THREE.CapsuleGeometry(.055,.17,6,14),lip,0,3.68,.548,0,0,Math.PI/2);
      mouth.scale.y=.36;

      // Hair styles
      if(look.hair==="afro"){
        const afro=mesh(new THREE.SphereGeometry(.70,36,26),hair,0,4.25,-.02);afro.scale.set(1.04,.80,.96);
      }else if(look.hair==="locs"){
        mesh(new THREE.SphereGeometry(.59,32,24),hair,0,4.22,-.05).scale.set(1,.55,.95);
        for(let i=-3;i<=3;i++){
          const strand=mesh(new THREE.CapsuleGeometry(.045,.55,6,12),hair,i*.13,4.03,.02,0,0,(i%2?-.05:.05));
          strand.scale.y=1.12;
        }
      }else if(look.hair==="braids"){
        mesh(new THREE.SphereGeometry(.60,32,24),hair,0,4.22,-.05).scale.set(1,.48,.95);
        for(let i=-3;i<=3;i++){
          mesh(new THREE.CapsuleGeometry(.035,.62,6,12),hair,i*.12,4.02,.04,0,0,(i%2?-.03:.03));
        }
      }else if(look.hair==="curls"){
        for(let y=0;y<3;y++)for(let x=-3;x<=3;x++){
          if(Math.abs(x)===3&&y===2)continue;
          mesh(new THREE.SphereGeometry(.13,18,14),hair,x*.14,4.22+y*.10,-.01+(Math.abs(x)*.01));
        }
      }else if(look.hair==="waves"){
        const h=mesh(new THREE.SphereGeometry(.59,36,24),hair,0,4.24,-.05);h.scale.set(1,.42,.95);
        for(let i=0;i<5;i++){
          const ring=mesh(new THREE.TorusGeometry(.34+i*.035,.012,8,40),white,0,4.31+i*.015,.45,Math.PI/2,0,0);
          ring.material=mat("#5b4639",.75,0);
        }
      }else if(look.hair==="short"){
        const h=mesh(new THREE.SphereGeometry(.59,36,24),hair,0,4.24,-.05);h.scale.set(1,.36,.95);
      }else if(look.hair==="buzz"){
        const h=mesh(new THREE.SphereGeometry(.58,36,24),hair,0,4.22,-.04);h.scale.set(1,.23,.95);
      }else{
        const h=mesh(new THREE.SphereGeometry(.59,36,24),hair,0,4.23,-.06);h.scale.set(1,.30,.94);
      }

      // Hats
      if(equipped.hat==="hat-cap"){
        mesh(new THREE.CylinderGeometry(.50,.55,.20,36),dark,0,4.48,0);
        mesh(new THREE.BoxGeometry(.48,.08,.34),dark,0,4.42,.40);
      }
      if(equipped.hat==="hat-beanie"){
        const beanie=mesh(new THREE.SphereGeometry(.61,36,24),mat("#111827",.72,0),0,4.43,-.03);beanie.scale.set(1,.58,.97);
      }
      if(equipped.hat==="hat-crown"){
        const crown=mesh(new THREE.CylinderGeometry(.42,.50,.36,8,1,true),mat("#fbbf24",.25,.72),0,4.58,0);
        crown.rotation.y=Math.PI/8;
      }

      // Glasses
      if(equipped.glasses){
        const glassMat=new THREE.MeshPhysicalMaterial({color:equipped.glasses==="glasses-shades"?0x111827:0x9fe8ff,transparent:true,opacity:equipped.glasses==="glasses-shades"?.74:.35,roughness:.2,metalness:.16});
        mesh(new THREE.BoxGeometry(.25,.14,.035),glassMat,-.20,4.00,.61);
        mesh(new THREE.BoxGeometry(.25,.14,.035),glassMat,.20,4.00,.61);
        mesh(new THREE.BoxGeometry(.12,.025,.025),dark,0,4.00,.61);
      }

      // Accessories
      if(equipped.accessory==="chain-silver"){
        const chain=mesh(new THREE.TorusGeometry(.28,.022,10,48,Math.PI),mat("#d1d5db",.2,.85),0,3.12,.52,Math.PI/2,0,Math.PI);
        chain.scale.y=1.3;
      }
      if(equipped.accessory==="headphones-cyan"){
        mesh(new THREE.TorusGeometry(.49,.055,12,48,Math.PI),mat("#22d3ee",.24,.32),0,4.05,-.02,0,0,0);
        mesh(new THREE.BoxGeometry(.12,.26,.15),dark,-.49,3.96,.03);
        mesh(new THREE.BoxGeometry(.12,.26,.15),dark,.49,3.96,.03);
      }
      if(equipped.accessory==="watch-smart"){
        mesh(new THREE.BoxGeometry(.12,.15,.10),dark,.97,2.15,.06,0,0,-.06);
      }
      if(equipped.accessory==="bag-tech"){
        mesh(new THREE.RoundedBoxGeometry?.(.72,.92,.30,4,.06) || new THREE.BoxGeometry(.72,.92,.30),mat("#111827",.5,.08),0,2.35,-.52);
      }

      // subtle chest logo
      const logo=mesh(new THREE.CircleGeometry(.11,28),white,0,2.66,.61,0,0,0);
      logo.material=mat("#e2e8f0",.3,.06);

      let dragging=false;
      let lastX=0;
      let yaw=0;
      renderer.domElement.addEventListener("pointerdown",e=>{dragging=true;lastX=e.clientX;renderer.domElement.setPointerCapture?.(e.pointerId);});
      renderer.domElement.addEventListener("pointermove",e=>{if(!dragging)return;const dx=e.clientX-lastX;lastX=e.clientX;yaw+=dx*.012;});
      const stop=()=>{dragging=false;};
      renderer.domElement.addEventListener("pointerup",stop);
      renderer.domElement.addEventListener("pointercancel",stop);

      const resize=()=>{
        const w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight);
        renderer.setSize(w,h,false);
        camera.aspect=w/h;
        camera.updateProjectionMatrix();
      };
      const ro=new ResizeObserver(resize);ro.observe(host);resize();

      const clock=new THREE.Clock();
      let frame=0;
      const loop=()=>{
        if(disposed)return;
        const t=clock.getElapsedTime();
        avatar.rotation.y=yaw+Math.sin(t*.45)*.035;
        avatar.position.y=Math.sin(t*1.35)*.012;
        torso.rotation.z=Math.sin(t*.85)*.006;
        sleeveL.rotation.z=.08+Math.sin(t*.85)*.008;
        sleeveR.rotation.z=-.08-Math.sin(t*.85)*.008;
        renderer.render(scene,camera);
        frame=requestAnimationFrame(loop);
      };
      loop();

      cleanup=()=>{
        cancelAnimationFrame(frame);
        ro.disconnect();
        renderer.dispose();
        scene.traverse((o:any)=>{
          o.geometry?.dispose?.();
          if(Array.isArray(o.material))o.material.forEach((m:any)=>m.dispose?.());
          else o.material?.dispose?.();
        });
        if(host.contains(renderer.domElement))host.removeChild(renderer.domElement);
      };
    };

    void boot();
    return()=>{disposed=true;cleanup();};
  },[look.skin,look.hair,look.hairColor,look.eyeColor,look.face,look.build,look.brows,equipped.top,equipped.bottom,equipped.shoes,equipped.hat,equipped.glasses,equipped.accessory,compact]);

  return <div ref={hostRef} className={className} aria-label="Interactive A.R.I.S.E. 3D character"/>;
}
