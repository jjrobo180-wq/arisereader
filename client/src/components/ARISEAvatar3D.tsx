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

function bell(x:number,c:number,w:number){
  const d=(x-c)/w;
  return Math.exp(-(d*d));
}

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
        if(disposed||!host)return;

        const canvasWrap=host.querySelector("[data-canvas-host]") as HTMLDivElement|null;
        if(!canvasWrap)return;
        canvasWrap.innerHTML="";

        const scene=new THREE.Scene();
        scene.background=new THREE.Color(0x07101c);
        scene.fog=new THREE.Fog(0x07101c,10,22);

        const camera=new THREE.PerspectiveCamera(view==="face"?24:28,1,.1,100);
        let cameraDistance=view==="face"?2.55:(compact?8.7:9.25);
        const targetY=view==="face"?4.13:2.44;
        camera.position.set(0,targetY+.02,cameraDistance);
        camera.lookAt(0,targetY,0);

        const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:"high-performance"});
        renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
        renderer.shadowMap.enabled=true;
        renderer.shadowMap.type=THREE.PCFSoftShadowMap;
        renderer.outputColorSpace=THREE.SRGBColorSpace;
        renderer.toneMapping=THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure=1.04;
        renderer.localClippingEnabled=true;
        renderer.domElement.style.cssText="width:100%;height:100%;display:block;touch-action:none;cursor:grab;";
        canvasWrap.appendChild(renderer.domElement);

        // Character-select lighting: warm key, cool rim, soft fill.
        scene.add(new THREE.HemisphereLight(0xeaf5ff,0x17120f,1.35));
        const key=new THREE.DirectionalLight(0xffe9d9,3.8);key.position.set(4.8,7.5,5.4);key.castShadow=true;key.shadow.mapSize.set(2048,2048);scene.add(key);
        const fill=new THREE.DirectionalLight(0xa9caff,1.35);fill.position.set(-4.2,4.3,4.5);scene.add(fill);
        const rim=new THREE.DirectionalLight(0x59d5ff,2.65);rim.position.set(-4.8,5.5,-5.0);scene.add(rim);
        const faceLight=new THREE.PointLight(0xffd6c3,view==="face"?1.7:.6,8);faceLight.position.set(0,4.45,3.4);scene.add(faceLight);

        const floor=new THREE.Mesh(
          new THREE.CylinderGeometry(2.15,2.42,.12,64),
          new THREE.MeshStandardMaterial({color:0x111827,roughness:.52,metalness:.22})
        );
        floor.position.y=.01;floor.receiveShadow=true;scene.add(floor);

        const avatar=new THREE.Group();
        scene.add(avatar);

        const [objText,targetText]=await Promise.all([
          fetch("/avatar/makehuman-base.obj",{cache:"force-cache"}).then(r=>{if(!r.ok)throw new Error("human mesh");return r.text();}),
          fetch("/avatar/arise-neutral-male-young.target",{cache:"force-cache"}).then(r=>{if(!r.ok)throw new Error("human morph");return r.text();})
        ]);
        if(disposed)return;

        // Parse the OBJ ourselves so MakeHuman target vertex IDs remain exact.
        const verts:number[][]=[];
        const bodyIndices:number[]=[];
        const helperRefs:Record<string,Set<number>>={
          "joint-l-eye":new Set<number>(),
          "joint-r-eye":new Set<number>(),
          "joint-head":new Set<number>(),
        };
        let group="";
        for(const raw of objText.split("\n")){
          if(raw.startsWith("v ")){
            const p=raw.trim().split(/\s+/);
            verts.push([Number(p[1]),Number(p[2]),Number(p[3])]);
          }else if(raw.startsWith("g ")){
            group=raw.slice(2).trim();
          }else if(raw.startsWith("f ")){
            const refs=raw.trim().split(/\s+/).slice(1).map(t=>{
              const vi=Number(t.split("/")[0]);
              return vi<0?verts.length+vi:vi-1;
            }).filter(v=>v>=0);
            if(group==="body"&&refs.length>=3){
              for(let i=1;i<refs.length-1;i++)bodyIndices.push(refs[0],refs[i],refs[i+1]);
            }
            if(helperRefs[group])for(const vi of refs)helperRefs[group].add(vi);
          }
        }
        if(!verts.length||!bodyIndices.length)throw new Error("body topology");

        // Apply the averaged CC0 MakeHuman male-young morph.
        for(const raw of targetText.split("\n")){
          if(!raw||raw.startsWith("#"))continue;
          const p=raw.trim().split(/\s+/);
          if(p.length<4)continue;
          const i=Number(p[0]);
          if(!verts[i])continue;
          verts[i][0]+=Number(p[1])*.92;
          verts[i][1]+=Number(p[2])*.92;
          verts[i][2]+=Number(p[3])*.92;
        }

        // A.R.I.S.E. stylized-realistic game proportions.
        let minY=Infinity,maxY=-Infinity;
        for(const v of verts){minY=Math.min(minY,v[1]);maxY=Math.max(maxY,v[1]);}
        const rangeY=maxY-minY;
        for(const v of verts){
          const u=(v[1]-minY)/rangeY;
          const shoulder=bell(u,.69,.075);
          const chest=bell(u,.64,.11);
          const waist=bell(u,.52,.075);
          const calf=bell(u,.19,.075);
          let width=1+shoulder*.085+chest*.028-waist*.038+calf*.012;
          if(look.build==="slim")width*=.965;
          if(look.build==="broad")width*=1.045;
          v[0]*=width;

          // Slightly stronger depth in chest/upper back, never balloon-like.
          let depth=1+chest*.035-waist*.018;
          if(look.build==="broad")depth*=1.025;
          if(look.build==="slim")depth*=.985;
          v[2]*=depth;

          // Face-shape pass only on upper head.
          if(u>.84){
            if(look.face==="round"){v[0]*=1.018;v[1]=maxY-(maxY-v[1])*.975;}
            else if(look.face==="square"){if(u<.93)v[0]*=1.028;}
            else if(look.face==="long"){v[0]*=.984;v[1]=maxY-(maxY-v[1])*1.025;}
          }
        }

        const positions=new Float32Array(verts.length*3);
        for(let i=0;i<verts.length;i++){
          positions[i*3]=verts[i][0];positions[i*3+1]=verts[i][1];positions[i*3+2]=verts[i][2];
        }
        const geometry=new THREE.BufferGeometry();
        geometry.setAttribute("position",new THREE.BufferAttribute(positions,3));
        geometry.setIndex(bodyIndices);
        geometry.computeVertexNormals();

        const skinMat=new THREE.MeshPhysicalMaterial({
          color:new THREE.Color(look.skin),
          roughness:.62,
          metalness:0,
          clearcoat:.025,
          clearcoatRoughness:.94,
          sheen:.04,
          sheenRoughness:1,
          sheenColor:new THREE.Color(look.skin),
        });
        const body=new THREE.Mesh(geometry,skinMat);
        body.castShadow=true;body.receiveShadow=true;

        const rawBox=new THREE.Box3().setFromObject(body);
        const rawSize=rawBox.getSize(new THREE.Vector3());
        const targetHeight=4.82;
        const scale=targetHeight/rawSize.y;
        const rawCenter=rawBox.getCenter(new THREE.Vector3());
        body.scale.setScalar(scale);
        body.position.set(-rawCenter.x*scale,-rawBox.min.y*scale+.08,-rawCenter.z*scale);
        avatar.add(body);

        const toWorld=(v:number[])=>new THREE.Vector3(
          (v[0]-rawCenter.x)*scale,
          (v[1]-rawBox.min.y)*scale+.08,
          (v[2]-rawCenter.z)*scale
        );
        const helperCenter=(name:string)=>{
          const ids=[...(helperRefs[name]||[])];
          if(!ids.length)return null;
          const c=[0,0,0];
          for(const id of ids){c[0]+=verts[id][0];c[1]+=verts[id][1];c[2]+=verts[id][2];}
          return toWorld([c[0]/ids.length,c[1]/ids.length,c[2]/ids.length]);
        };

        const box=new THREE.Box3().setFromObject(body);
        const topY=box.max.y;
        const frontZ=box.max.z;
        const leftEye=helperCenter("joint-l-eye")||new THREE.Vector3(-.17,4.18,frontZ-.18);
        const rightEye=helperCenter("joint-r-eye")||new THREE.Vector3(.17,4.18,frontZ-.18);
        const eyeY=(leftEye.y+rightEye.y)/2;
        const eyeZ=Math.max(leftEye.z,rightEye.z)+.035;
        const lx=leftEye.x,rx=rightEye.x;

        // Eyes that sit inside the real sculpted sockets.
        const eyeWhite=new THREE.MeshPhysicalMaterial({color:0xf2f0ea,roughness:.20,clearcoat:.22});
        const irisMat=new THREE.MeshPhysicalMaterial({color:new THREE.Color(look.eyeColor),roughness:.20,clearcoat:.32});
        const pupilMat=new THREE.MeshStandardMaterial({color:0x030405,roughness:.2});
        const addEye=(x:number)=>{
          const g=new THREE.Group();g.position.set(x,eyeY,eyeZ);avatar.add(g);
          const white=new THREE.Mesh(new THREE.SphereGeometry(.039,32,24),eyeWhite);white.scale.set(1.15,.72,.50);g.add(white);
          const iris=new THREE.Mesh(new THREE.SphereGeometry(.018,28,20),irisMat);iris.position.z=.029;iris.scale.z=.28;g.add(iris);
          const pupil=new THREE.Mesh(new THREE.SphereGeometry(.007,20,14),pupilMat);pupil.position.z=.036;pupil.scale.z=.18;g.add(pupil);
          const glint=new THREE.Mesh(new THREE.SphereGeometry(.0024,12,8),new THREE.MeshBasicMaterial({color:0xffffff}));glint.position.set(-.005,.006,.041);g.add(glint);
        };
        addEye(lx);addEye(rx);

        const hairMat=new THREE.MeshStandardMaterial({color:new THREE.Color(look.hairColor),roughness:.88,metalness:0});
        const browThickness=look.brows==="bold"?.013:.009;
        const browLength=Math.max(.10,Math.abs(rx-lx)*.38);
        for(const [x,rot] of [[lx,look.brows==="straight"?0:.10],[rx,look.brows==="straight"?0:-.10]] as any){
          const b=new THREE.Mesh(new THREE.CapsuleGeometry(browThickness,browLength,5,12),hairMat);
          b.position.set(x,eyeY+.098,eyeZ+.045);b.rotation.z=Math.PI/2+rot;b.scale.y=.64;avatar.add(b);
        }

        // Sculpted game hair: layered tapered pieces instead of a helmet.
        const headCenterZ=frontZ-.25;
        const hairGroup=new THREE.Group();avatar.add(hairGroup);
        const strandMat=new THREE.MeshPhysicalMaterial({color:new THREE.Color(look.hairColor),roughness:.82,metalness:0,clearcoat:.02});
        const addStrand=(x:number,y:number,z:number,sx:number,sy:number,sz:number,rz=0)=>{
          const strand=new THREE.Mesh(new THREE.ConeGeometry(.065,.34,10,1,false),strandMat);
          strand.position.set(x,y,z);strand.scale.set(sx,sy,sz);strand.rotation.z=rz;hairGroup.add(strand);
        };
        if(look.hair==="afro"){
          for(let i=0;i<30;i++){
            const theta=(i/30)*Math.PI*2;
            const r=i%3===0?.29:.23;
            const puff=new THREE.Mesh(new THREE.DodecahedronGeometry(.075,1),strandMat);
            puff.position.set(Math.cos(theta)*r,topY-.20+Math.sin(i*1.7)*.04,headCenterZ+Math.sin(theta)*.15);
            hairGroup.add(puff);
          }
        }else if(look.hair==="locs"||look.hair==="braids"){
          const count=look.hair==="locs"?11:15;
          for(let i=0;i<count;i++){
            const t=i/(count-1);
            const loc=new THREE.Mesh(new THREE.CapsuleGeometry(look.hair==="locs"?.014:.009,.30,6,12),strandMat);
            loc.position.set((t-.5)*.50,topY-.34,headCenterZ-.02-Math.abs(t-.5)*.05);
            loc.rotation.z=(t-.5)*.13;hairGroup.add(loc);
          }
          for(let i=0;i<9;i++)addStrand((i-4)*.055,topY-.10,headCenterZ-.04,1,.55,1,(i-4)*.025);
        }else{
          for(let i=-5;i<=5;i++){
            const x=i*.05;
            const height=look.hair==="buzz"?.22:look.hair==="waves"?.38:look.hair==="short"?.52:.66;
            addStrand(x,topY-.12-Math.abs(i)*.006,headCenterZ-.045,1,height,1,-i*.035);
          }
          for(let i=-4;i<=4;i++)addStrand(i*.052,topY-.18,headCenterZ-.13,1,(look.hair==="fade"?.48:.58),1,-i*.025);
          if(look.hair==="curls"){
            for(let i=0;i<16;i++){
              const theta=(i/16)*Math.PI*2;
              const curl=new THREE.Mesh(new THREE.DodecahedronGeometry(.050,1),strandMat);
              curl.position.set(Math.cos(theta)*.24,topY-.16+Math.sin(i*1.9)*.025,headCenterZ+Math.sin(theta)*.10);
              hairGroup.add(curl);
            }
          }
        }

        const topColor=equipped.top==="jacket-varsity"?"#0f766e":equipped.top==="hoodie-neon"?"#5b2db6":equipped.top==="hoodie-midnight"?"#111827":"#177f7b";
        const pantsColor=equipped.bottom==="pants-cargo"?"#44515d":"#1e326d";
        const shoeColor=equipped.shoes==="shoes-neon"?"#63e4ee":equipped.shoes==="shoes-white"?"#eff2f6":"#d2dae4";
        const topMat=new THREE.MeshPhysicalMaterial({color:new THREE.Color(topColor),roughness:.62,clearcoat:.035});
        const pantsMat=new THREE.MeshPhysicalMaterial({color:new THREE.Color(pantsColor),roughness:.72});
        const shoeMat=new THREE.MeshPhysicalMaterial({color:new THREE.Color(shoeColor),roughness:.48});
        const darkMat=new THREE.MeshStandardMaterial({color:0x18202c,roughness:.68});
        const accentMat=new THREE.MeshStandardMaterial({color:0x79e4ef,roughness:.40,metalness:.18});

        const cloneShell=(material:any,lowY:number,highY:number,expand:number)=>{
          const shell=new THREE.Mesh(geometry,material);
          shell.position.copy(body.position);
          shell.scale.copy(body.scale).multiplyScalar(expand);
          shell.material=material.clone();
          shell.material.clippingPlanes=[
            new THREE.Plane(new THREE.Vector3(0,1,0),-lowY),
            new THREE.Plane(new THREE.Vector3(0,-1,0),highY)
          ];
          shell.castShadow=true;shell.receiveShadow=true;avatar.add(shell);return shell;
        };
        cloneShell(topMat,2.08,3.58,1.014);
        cloneShell(pantsMat,.38,2.16,1.012);
        cloneShell(shoeMat,.07,.46,1.022);

        // Layered streetwear / character-select detail.
        const belt=new THREE.Mesh(new THREE.CylinderGeometry(.41,.40,.095,40),darkMat);belt.position.set(0,2.04,0);belt.scale.z=.72;avatar.add(belt);
        const buckle=new THREE.Mesh(new THREE.BoxGeometry(.18,.12,.055),accentMat);buckle.position.set(0,2.04,frontZ+.015);avatar.add(buckle);

        if(equipped.top==="jacket-varsity"||equipped.top==="hoodie-midnight"||equipped.top==="hoodie-neon"){
          const vest=new THREE.Mesh(new THREE.BoxGeometry(.72,.84,.20),new THREE.MeshPhysicalMaterial({color:equipped.top==="hoodie-neon"?0x2f2255:0x27303b,roughness:.72}));
          vest.position.set(0,2.92,frontZ-.01);vest.scale.x=1.08;avatar.add(vest);
          for(const x of [-.23,.23]){
            const pocket=new THREE.Mesh(new THREE.BoxGeometry(.22,.18,.065),darkMat);pocket.position.set(x,2.84,frontZ+.115);avatar.add(pocket);
          }
          const collar=new THREE.Mesh(new THREE.TorusGeometry(.20,.045,10,32,Math.PI*1.55),topMat);
          collar.position.set(0,3.55,.02);collar.rotation.x=Math.PI/2;collar.rotation.z=Math.PI*.22;avatar.add(collar);
        }

        if(equipped.bottom==="pants-cargo"){
          for(const x of [-.30,.30]){
            const pocket=new THREE.Mesh(new THREE.BoxGeometry(.20,.26,.065),pantsMat);pocket.position.set(x,1.50,frontZ-.02);avatar.add(pocket);
            const knee=new THREE.Mesh(new THREE.BoxGeometry(.23,.15,.07),darkMat);knee.position.set(x,1.04,frontZ-.015);avatar.add(knee);
          }
        }

        // Boots get a defined cuff and sole.
        for(const x of [-.22,.22]){
          const cuff=new THREE.Mesh(new THREE.CylinderGeometry(.13,.14,.16,24),darkMat);cuff.position.set(x,.43,0);avatar.add(cuff);
          const sole=new THREE.Mesh(new THREE.BoxGeometry(.30,.07,.52),darkMat);sole.position.set(x,.12,.12);avatar.add(sole);
        }

        if(equipped.hat==="hat-cap"){
          const capMat=new THREE.MeshStandardMaterial({color:0x121a27,roughness:.75});
          const cap=new THREE.Mesh(new THREE.CylinderGeometry(.30,.33,.11,40),capMat);cap.position.set(0,topY-.06,headCenterZ-.04);avatar.add(cap);
          const bill=new THREE.Mesh(new THREE.BoxGeometry(.32,.035,.21),capMat);bill.position.set(0,topY-.10,headCenterZ+.26);avatar.add(bill);
        }else if(equipped.hat==="hat-beanie"){
          const beanie=new THREE.Mesh(new THREE.SphereGeometry(.34,36,24),new THREE.MeshStandardMaterial({color:0x101827,roughness:.85}));
          beanie.position.set(0,topY-.11,headCenterZ-.04);beanie.scale.set(1,.48,.88);avatar.add(beanie);
        }else if(equipped.hat==="hat-crown"){
          const crown=new THREE.Mesh(new THREE.CylinderGeometry(.23,.30,.24,8,1,true),new THREE.MeshStandardMaterial({color:0xfbbf24,roughness:.28,metalness:.55}));
          crown.position.set(0,topY+.01,headCenterZ-.03);crown.rotation.y=Math.PI/8;avatar.add(crown);
        }

        if(equipped.glasses){
          const frameMat=new THREE.MeshStandardMaterial({color:equipped.glasses==="glasses-shades"?0x111827:0x334155,roughness:.32,metalness:.35});
          for(const x of [lx,rx]){
            const ring=new THREE.Mesh(new THREE.TorusGeometry(.085,.008,8,30),frameMat);ring.position.set(x,eyeY,eyeZ+.075);avatar.add(ring);
          }
          const bridge=new THREE.Mesh(new THREE.BoxGeometry(Math.max(.04,Math.abs(rx-lx)-.15),.010,.010),frameMat);bridge.position.set(0,eyeY,eyeZ+.075);avatar.add(bridge);
        }

        if(equipped.accessory==="chain-silver"){
          const chain=new THREE.Mesh(new THREE.TorusGeometry(.18,.011,8,44,Math.PI),new THREE.MeshStandardMaterial({color:0xcfd6de,roughness:.22,metalness:.86}));
          chain.position.set(0,3.30,frontZ-.02);chain.rotation.x=Math.PI/2;chain.rotation.z=Math.PI;chain.scale.y=1.18;avatar.add(chain);
        }
        if(equipped.accessory==="headphones-cyan"){
          const phones=new THREE.Mesh(new THREE.TorusGeometry(.30,.024,10,44,Math.PI),accentMat);phones.position.set(0,4.13,-.01);avatar.add(phones);
        }
        if(equipped.accessory==="watch-smart"){
          const watch=new THREE.Mesh(new THREE.BoxGeometry(.10,.14,.045),darkMat);watch.position.set(.55,2.10,frontZ-.12);avatar.add(watch);
        }
        if(equipped.accessory==="bag-tech"){
          const bag=new THREE.Mesh(new THREE.BoxGeometry(.54,.72,.19),darkMat);bag.position.set(0,2.72,box.min.z-.06);avatar.add(bag);
        }

        let dragging=false,lastX=0,yaw=0;
        const down=(e:PointerEvent)=>{dragging=true;lastX=e.clientX;renderer.domElement.style.cursor="grabbing";renderer.domElement.setPointerCapture?.(e.pointerId);};
        const move=(e:PointerEvent)=>{if(!dragging)return;const dx=e.clientX-lastX;lastX=e.clientX;yaw+=dx*.0085;};
        const stop=()=>{dragging=false;renderer.domElement.style.cursor="grab";};
        const wheel=(e:WheelEvent)=>{
          e.preventDefault();e.stopPropagation();
          const min=view==="face"?2.10:7.2,max=view==="face"?4.0:11.0;
          cameraDistance=Math.min(max,Math.max(min,cameraDistance+e.deltaY*.0026));
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
            const min=view==="face"?2.10:7.2,max=view==="face"?4.0:11.0;
            cameraDistance=Math.min(max,Math.max(min,cameraDistance+(pinch-d)*.0065));
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
          avatar.rotation.y=yaw+Math.sin(t*.32)*.010;
          avatar.position.y=Math.sin(t*.75)*.004;
          camera.position.z+=(cameraDistance-camera.position.z)*.14;
          camera.lookAt(0,targetY,0);
          renderer.render(scene,camera);
          frame=requestAnimationFrame(loop);
        };
        loop();
        setStatus("ready");

        cleanup=()=>{
          cancelAnimationFrame(frame);ro.disconnect();renderer.dispose();
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

  return <div ref={hostRef} className={"relative overflow-hidden "+className} aria-label="Interactive A.R.I.S.E. stylized realistic 3D character">
    <div data-canvas-host className="absolute inset-0"/>
    {status==="loading"&&<div className="absolute inset-0 z-20 grid place-items-center bg-slate-950"><div className="text-center"><div className="w-10 h-10 border-4 border-cyan-300 border-t-transparent rounded-full animate-spin mx-auto"/><p className="mt-3 text-sm font-black text-white/70">Loading game character…</p></div></div>}
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
