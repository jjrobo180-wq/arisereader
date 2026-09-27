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
  const [status,setStatus]=useState<"loading"|"ready"|"error">("loading");

  useEffect(()=>{
    const host=hostRef.current;
    if(!host)return;
    let disposed=false;
    let cleanup=()=>{};
    setStatus("loading");

    const boot=async()=>{
      try{
        const THREE:any=await import(/* @vite-ignore */ "https://esm.sh/three@0.180.0");
        const loaderMod:any=await import(/* @vite-ignore */ "https://esm.sh/three@0.180.0/examples/jsm/loaders/OBJLoader.js");
        if(disposed||!host)return;

        const canvasWrap=host.querySelector("[data-canvas-host]") as HTMLDivElement|null;
        if(!canvasWrap)return;
        canvasWrap.innerHTML="";

        const scene=new THREE.Scene();
        scene.background=new THREE.Color(0x07101c);
        scene.fog=new THREE.Fog(0x07101c,9,18);

        const camera=new THREE.PerspectiveCamera(view==="face"?25:29,1,.1,100);
        let cameraDistance=view==="face"?2.15:(compact?7.2:7.7);
        const targetY=view==="face"?4.15:2.36;
        camera.position.set(0,targetY+.03,cameraDistance);
        camera.lookAt(0,targetY,0);

        const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:"high-performance"});
        renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
        renderer.shadowMap.enabled=true;
        renderer.shadowMap.type=THREE.PCFSoftShadowMap;
        renderer.outputColorSpace=THREE.SRGBColorSpace;
        renderer.toneMapping=THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure=1.0;
        renderer.localClippingEnabled=true;
        renderer.domElement.style.cssText="width:100%;height:100%;display:block;touch-action:none;cursor:grab;";
        canvasWrap.appendChild(renderer.domElement);

        scene.add(new THREE.HemisphereLight(0xeaf6ff,0x16110e,1.55));
        const key=new THREE.DirectionalLight(0xffefe2,3.4);key.position.set(4.5,7,5);key.castShadow=true;key.shadow.mapSize.set(1024,1024);scene.add(key);
        const fill=new THREE.DirectionalLight(0x9fc8ff,1.55);fill.position.set(-4,4.8,4.2);scene.add(fill);
        const rim=new THREE.DirectionalLight(0x55c9ff,2.15);rim.position.set(-4.5,5,-4.5);scene.add(rim);
        const faceLight=new THREE.PointLight(0xffd7c2,view==="face"?1.5:.65,8);faceLight.position.set(0,4.4,3.2);scene.add(faceLight);

        const floor=new THREE.Mesh(
          new THREE.CylinderGeometry(2.25,2.45,.12,64),
          new THREE.MeshStandardMaterial({color:0x111827,roughness:.55,metalness:.2})
        );
        floor.position.y=.01;floor.receiveShadow=true;scene.add(floor);

        const avatar=new THREE.Group();
        scene.add(avatar);

        const objText=await fetch("/avatar/makehuman-base.obj",{cache:"force-cache"}).then(r=>{
          if(!r.ok)throw new Error("Human mesh could not load");
          return r.text();
        });
        if(disposed)return;

        const loader=new loaderMod.OBJLoader();
        const root=loader.parse(objText);

        let bodyMesh:any=null;
        let tightsMesh:any=null;
        const helperCenters:Record<string,any>={};

        root.traverse((node:any)=>{
          if(!node.isMesh)return;
          node.geometry.computeVertexNormals?.();
          const name=String(node.name||node.parent?.name||"");
          if(name==="body"||(!bodyMesh&&name.toLowerCase().includes("body")))bodyMesh=node;
          if(name==="helper-tights")tightsMesh=node;
          if(/^joint-(l-eye|r-eye|head)/.test(name)){
            const b=new THREE.Box3().setFromObject(node);
            helperCenters[name]=b.getCenter(new THREE.Vector3());
          }
          node.visible=false;
        });

        if(!bodyMesh)throw new Error("Human body geometry was not found");

        const body=bodyMesh.clone();
        body.geometry=bodyMesh.geometry.clone();

        // Subtle native morphs for build + face while preserving real human topology.
        const pos=body.geometry.attributes.position;
        for(let i=0;i<pos.count;i++){
          let x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);

          // Build affects body below the jaw, but does not turn the character into a balloon.
          if(y<6.15){
            const torsoFactor=look.build==="slim"?.955:look.build==="broad"?1.055:1;
            const legFactor=look.build==="slim"?.975:look.build==="broad"?1.025:1;
            const factor=y>3.0?torsoFactor:legFactor;
            x*=factor;
            if(y>3.1&&y<5.9)z*=look.build==="broad"?1.025:look.build==="slim"?.985:1;
          }

          // Face-shape morph only affects the actual head vertices.
          if(y>6.18){
            const cy=7.25;
            if(look.face==="round"){x*=1.025;y=cy+(y-cy)*.965;z*=1.018;}
            else if(look.face==="square"){if(y<7.2)x*=1.045;else x*=1.015;}
            else if(look.face==="long"){x*=.975;y=cy+(y-cy)*1.035;}
            else{x*=.992;}
          }
          pos.setXYZ(i,x,y,z);
        }
        pos.needsUpdate=true;
        body.geometry.computeVertexNormals();

        const skinMat=new THREE.MeshPhysicalMaterial({
          color:new THREE.Color(look.skin),
          roughness:.62,
          metalness:0,
          clearcoat:.035,
          clearcoatRoughness:.92,
          sheen:.08,
          sheenRoughness:.95,
          sheenColor:new THREE.Color(look.skin),
        });
        body.material=skinMat;
        body.visible=true;
        body.castShadow=true;
        body.receiveShadow=true;

        // Fit native MakeHuman coordinates to our stage.
        const rawBox=new THREE.Box3().setFromObject(body);
        const rawSize=rawBox.getSize(new THREE.Vector3());
        const targetHeight=4.78;
        const scale=targetHeight/rawSize.y;
        const rawCenter=rawBox.getCenter(new THREE.Vector3());
        body.scale.setScalar(scale);
        body.position.x=-rawCenter.x*scale;
        body.position.z=-rawCenter.z*scale;
        body.position.y=-rawBox.min.y*scale+.08;
        avatar.add(body);

        const toWorld=(v:any)=>new THREE.Vector3(
          (v.x-rawCenter.x)*scale,
          (v.y-rawBox.min.y)*scale+.08,
          (v.z-rawCenter.z)*scale
        );

        const bodyWorldBox=new THREE.Box3().setFromObject(body);
        const bodySize=bodyWorldBox.getSize(new THREE.Vector3());

        // Real eyes placed using MakeHuman's own joint guides when available.
        const eyeFallbackY=4.18, eyeFallbackZ=.40;
        const leftGuide=helperCenters["joint-l-eye"]?toWorld(helperCenters["joint-l-eye"]):new THREE.Vector3(-.17,eyeFallbackY,eyeFallbackZ);
        const rightGuide=helperCenters["joint-r-eye"]?toWorld(helperCenters["joint-r-eye"]):new THREE.Vector3(.17,eyeFallbackY,eyeFallbackZ);
        const eyeY=(leftGuide.y+rightGuide.y)/2;
        const eyeZ=Math.max(leftGuide.z,rightGuide.z)+.045;
        const lx=leftGuide.x,rx=rightGuide.x;

        const eyeWhite=new THREE.MeshPhysicalMaterial({color:0xf3f1ec,roughness:.22,clearcoat:.18});
        const irisMat=new THREE.MeshPhysicalMaterial({color:new THREE.Color(look.eyeColor),roughness:.22,clearcoat:.3});
        const pupilMat=new THREE.MeshStandardMaterial({color:0x050607,roughness:.25});
        const addEye=(x:number)=>{
          const g=new THREE.Group();g.position.set(x,eyeY,eyeZ);avatar.add(g);
          const white=new THREE.Mesh(new THREE.SphereGeometry(.065,32,24),eyeWhite);white.scale.set(1.18,.82,.64);g.add(white);
          const iris=new THREE.Mesh(new THREE.SphereGeometry(.031,28,20),irisMat);iris.position.z=.052;iris.scale.z=.4;g.add(iris);
          const pupil=new THREE.Mesh(new THREE.SphereGeometry(.013,20,14),pupilMat);pupil.position.z=.068;pupil.scale.z=.25;g.add(pupil);
          const glint=new THREE.Mesh(new THREE.SphereGeometry(.0048,12,8),new THREE.MeshBasicMaterial({color:0xffffff}));glint.position.set(-.009,.009,.078);g.add(glint);
        };
        addEye(lx);addEye(rx);

        // Brows: subtle, not blocky.
        const hairMat=new THREE.MeshStandardMaterial({color:new THREE.Color(look.hairColor),roughness:.9});
        const browThickness=look.brows==="bold"?.014:.010;
        const browLen=Math.max(.105,Math.abs(rx-lx)*.37);
        for(const [x,rot] of [[lx,look.brows==="straight"?0:.10],[rx,look.brows==="straight"?0:-.10]] as any){
          const brow=new THREE.Mesh(new THREE.CapsuleGeometry(browThickness,browLen,5,12),hairMat);
          brow.position.set(x,eyeY+.105,eyeZ+.055);brow.rotation.z=Math.PI/2+rot;brow.scale.y=.65;avatar.add(brow);
        }

        // Hair follows the real cranium instead of replacing it.
        const topY=bodyWorldBox.max.y;
        const headCenterX=0;
        const headZ=bodyWorldBox.max.z-.25;
        const capMaterial=new THREE.MeshPhysicalMaterial({color:new THREE.Color(look.hairColor),roughness:.88,metalness:0});
        if(look.hair==="afro"){
          for(let a=0;a<18;a++){
            const theta=(a/18)*Math.PI*2;
            const r=.27+(a%3)*.025;
            const puff=new THREE.Mesh(new THREE.SphereGeometry(.13,18,14),capMaterial);
            puff.position.set(Math.cos(theta)*r,topY-.22+Math.sin(a*1.7)*.04,headZ+Math.sin(theta)*.16);
            avatar.add(puff);
          }
          const crown=new THREE.Mesh(new THREE.SphereGeometry(.35,28,20),capMaterial);crown.position.set(0,topY-.14,headZ-.02);crown.scale.set(1.05,.72,.86);avatar.add(crown);
        }else if(look.hair==="locs"||look.hair==="braids"){
          const cap=new THREE.Mesh(new THREE.SphereGeometry(.34,32,22),capMaterial);cap.position.set(0,topY-.18,headZ-.02);cap.scale.set(1,.48,.84);avatar.add(cap);
          const count=look.hair==="locs"?10:14;
          for(let i=0;i<count;i++){
            const t=i/(count-1);
            const strand=new THREE.Mesh(new THREE.CapsuleGeometry(look.hair==="locs"?.028:.018,.40,6,12),capMaterial);
            strand.position.set((t-.5)*.62,topY-.42,headZ+.02-Math.abs(t-.5)*.08);
            strand.rotation.z=(t-.5)*.16;avatar.add(strand);
          }
        }else{
          const cap=new THREE.Mesh(new THREE.SphereGeometry(.35,36,24),capMaterial);
          cap.position.set(headCenterX,topY-.18,headZ-.03);
          cap.scale.set(1,look.hair==="buzz"?.20:look.hair==="waves"?.27:look.hair==="short"?.31:look.hair==="curls"?.43:.28,.86);
          avatar.add(cap);
          if(look.hair==="curls"){
            for(let i=0;i<12;i++){
              const theta=(i/12)*Math.PI*2;
              const curl=new THREE.Mesh(new THREE.SphereGeometry(.065,16,12),capMaterial);
              curl.position.set(Math.cos(theta)*.28,topY-.10+Math.sin(i*2.2)*.035,headZ+Math.sin(theta)*.12);
              avatar.add(curl);
            }
          }
        }

        // Clothes are fitted shells cloned from the actual human body, so they follow
        // the real silhouette instead of looking like giant capsules.
        const cloneShell=(color:string,lowY:number,highY:number,expand:number)=>{
          const shell=body.clone();
          shell.geometry=body.geometry;
          shell.position.copy(body.position);
          shell.scale.copy(body.scale).multiplyScalar(expand);
          const mat=new THREE.MeshPhysicalMaterial({
            color:new THREE.Color(color),roughness:.56,metalness:.01,clearcoat:.025,
            clippingPlanes:[
              new THREE.Plane(new THREE.Vector3(0,1,0),-lowY),
              new THREE.Plane(new THREE.Vector3(0,-1,0),highY)
            ]
          });
          shell.material=mat;shell.visible=true;shell.castShadow=true;shell.receiveShadow=true;avatar.add(shell);
          return shell;
        };
        const topColor=equipped.top==="jacket-varsity"?"#0f766e":equipped.top==="hoodie-neon"?"#6530b8":equipped.top==="hoodie-midnight"?"#111827":"#0f766e";
        const pantsColor=equipped.bottom==="pants-cargo"?"#334155":"#172554";
        const shoeColor=equipped.shoes==="shoes-neon"?"#67e8f9":equipped.shoes==="shoes-white"?"#f4f5f7":"#dce3ea";
        cloneShell(topColor,2.10,3.55,1.012);
        cloneShell(pantsColor,.42,2.16,1.011);
        cloneShell(shoeColor,.08,.47,1.016);

        // Hide any exposed center-pelvis detail beneath an opaque waistband.
        const waist=new THREE.Mesh(new THREE.CylinderGeometry(.43,.39,.24,40),new THREE.MeshStandardMaterial({color:new THREE.Color(pantsColor),roughness:.6}));
        waist.position.set(0,2.00,0);waist.scale.z=.72;avatar.add(waist);

        // Accessories stay small and proportional.
        if(equipped.hat==="hat-cap"){
          const hatMat=new THREE.MeshStandardMaterial({color:0x101827,roughness:.72});
          const cap=new THREE.Mesh(new THREE.CylinderGeometry(.34,.36,.12,40),hatMat);cap.position.set(0,topY-.04,headZ-.03);avatar.add(cap);
          const bill=new THREE.Mesh(new THREE.BoxGeometry(.34,.04,.22),hatMat);bill.position.set(0,topY-.08,headZ+.30);avatar.add(bill);
        }else if(equipped.hat==="hat-beanie"){
          const beanie=new THREE.Mesh(new THREE.SphereGeometry(.37,36,24),new THREE.MeshStandardMaterial({color:0x111827,roughness:.8}));
          beanie.position.set(0,topY-.09,headZ-.03);beanie.scale.set(1,.50,.90);avatar.add(beanie);
        }
        if(equipped.glasses){
          const frameMat=new THREE.MeshStandardMaterial({color:equipped.glasses==="glasses-shades"?0x111827:0x334155,roughness:.32,metalness:.35});
          for(const x of [lx,rx]){
            const ring=new THREE.Mesh(new THREE.TorusGeometry(.092,.009,8,30),frameMat);
            ring.position.set(x,eyeY,eyeZ+.09);avatar.add(ring);
          }
          const bridge=new THREE.Mesh(new THREE.BoxGeometry(Math.abs(rx-lx)-.16,.012,.012),frameMat);bridge.position.set(0,eyeY,eyeZ+.09);avatar.add(bridge);
        }
        if(equipped.accessory==="chain-silver"){
          const chain=new THREE.Mesh(new THREE.TorusGeometry(.20,.012,8,40,Math.PI),new THREE.MeshStandardMaterial({color:0xcbd5e1,roughness:.25,metalness:.85}));
          chain.position.set(0,3.30,.31);chain.rotation.x=Math.PI/2;chain.rotation.z=Math.PI;chain.scale.y=1.2;avatar.add(chain);
        }

        let dragging=false,lastX=0,yaw=0;
        const down=(e:PointerEvent)=>{dragging=true;lastX=e.clientX;renderer.domElement.style.cursor="grabbing";renderer.domElement.setPointerCapture?.(e.pointerId);};
        const move=(e:PointerEvent)=>{if(!dragging)return;const dx=e.clientX-lastX;lastX=e.clientX;yaw+=dx*.009;};
        const stop=()=>{dragging=false;renderer.domElement.style.cursor="grab";};
        const wheel=(e:WheelEvent)=>{
          e.preventDefault();
          e.stopPropagation();
          const min=view==="face"?1.45:5.8,max=view==="face"?3.1:9.2;
          cameraDistance=Math.min(max,Math.max(min,cameraDistance+e.deltaY*.0028));
        };
        renderer.domElement.addEventListener("pointerdown",down);
        renderer.domElement.addEventListener("pointermove",move);
        renderer.domElement.addEventListener("pointerup",stop);
        renderer.domElement.addEventListener("pointercancel",stop);
        renderer.domElement.addEventListener("wheel",wheel,{passive:false});

        let pinch=0;
        const touchStart=(e:TouchEvent)=>{
          if(e.touches.length===2)pinch=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
        };
        const touchMove=(e:TouchEvent)=>{
          if(e.touches.length!==2)return;
          e.preventDefault();e.stopPropagation();
          const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
          if(pinch){
            const min=view==="face"?1.45:5.8,max=view==="face"?3.1:9.2;
            cameraDistance=Math.min(max,Math.max(min,cameraDistance+(pinch-d)*.007));
          }
          pinch=d;
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
          avatar.rotation.y=yaw+Math.sin(t*.35)*.012;
          avatar.position.y=Math.sin(t*.8)*.005;
          camera.position.z+=(cameraDistance-camera.position.z)*.14;
          camera.lookAt(0,targetY,0);
          renderer.render(scene,camera);
          frame=requestAnimationFrame(loop);
        };
        loop();
        setStatus("ready");

        cleanup=()=>{
          cancelAnimationFrame(frame);ro.disconnect();
          renderer.dispose();
          scene.traverse((o:any)=>{
            o.geometry?.dispose?.();
            if(Array.isArray(o.material))o.material.forEach((m:any)=>m.dispose?.());else o.material?.dispose?.();
          });
          if(canvasWrap.contains(renderer.domElement))canvasWrap.removeChild(renderer.domElement);
        };
      }catch(err){
        console.error("[ARISE Avatar]",err);
        if(!disposed)setStatus("error");
      }
    };

    void boot();
    return()=>{disposed=true;cleanup();};
  },[look.skin,look.hair,look.hairColor,look.eyeColor,look.face,look.build,look.brows,equipped.top,equipped.bottom,equipped.shoes,equipped.hat,equipped.glasses,equipped.accessory,compact,view]);

  return <div ref={hostRef} className={"relative overflow-hidden "+className} aria-label="Interactive A.R.I.S.E. realistic 3D character">
    <div data-canvas-host className="absolute inset-0"/>
    {status==="loading"&&<div className="absolute inset-0 z-20 grid place-items-center bg-slate-950"><div className="text-center"><div className="w-10 h-10 border-4 border-cyan-300 border-t-transparent rounded-full animate-spin mx-auto"/><p className="mt-3 text-sm font-black text-white/70">Loading realistic human model…</p></div></div>}
    {status==="error"&&<div className="absolute inset-0 z-20 grid place-items-center bg-slate-950 p-6"><div className="text-center"><p className="font-black">Character model did not load.</p><button type="button" onClick={()=>window.location.reload()} className="mt-3 rounded-xl bg-white text-slate-950 px-4 py-2 font-black">Reload</button></div></div>}
    {controls&&status==="ready"&&<div className="absolute left-3 top-3 z-10 flex gap-2 rounded-2xl bg-slate-950/75 backdrop-blur p-1.5 border border-white/10">
      <button type="button" onClick={()=>setView("full")} className={"rounded-xl px-3 py-2 text-xs font-black "+(view==="full"?"bg-white text-slate-950":"text-white/70")}>FULL BODY</button>
      <button type="button" onClick={()=>setView("face")} className={"rounded-xl px-3 py-2 text-xs font-black "+(view==="face"?"bg-white text-slate-950":"text-white/70")}>FACE</button>
    </div>}
    {controls&&status==="ready"&&<div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 rounded-full bg-slate-950/70 backdrop-blur px-4 py-2 text-[11px] font-black text-white/70 border border-white/10 whitespace-nowrap">
      Drag to rotate · Scroll/pinch to zoom
    </div>}
  </div>;
}
