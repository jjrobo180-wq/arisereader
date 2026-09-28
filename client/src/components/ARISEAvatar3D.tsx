import { useEffect, useRef, useState } from "react";
import { getAvatarCharacter } from "@/lib/avatarCharacters";

type Props={
  characterId:string;
  equipped:Record<string,string>;
  className?:string;
  compact?:boolean;
  initialView?:"full"|"face";
  controls?:boolean;
};

export default function ARISEAvatar3D({characterId,equipped,className="",compact=false,initialView="full",controls=true}:Props){
  const hostRef=useRef<HTMLDivElement|null>(null);
  const [view,setView]=useState<"full"|"face">(initialView);
  const [status,setStatus]=useState<"loading"|"ready"|"error">("loading");
  const character=getAvatarCharacter(characterId);

  useEffect(()=>{
    const host=hostRef.current;
    if(!host)return;
    let disposed=false;
    let cleanup=()=>{};
    setStatus("loading");

    const boot=async()=>{
      try{
        const THREE:any=await import(/* @vite-ignore */ "https://esm.sh/three@0.180.0");
        const {GLTFLoader}:any=await import(/* @vite-ignore */ "https://esm.sh/three@0.180.0/examples/jsm/loaders/GLTFLoader.js");
        if(disposed)return;

        const mount=host.querySelector("[data-canvas-host]") as HTMLDivElement|null;
        if(!mount)return;
        mount.innerHTML="";

        const scene=new THREE.Scene();
        scene.background=new THREE.Color(0x07101d);
        scene.fog=new THREE.Fog(0x07101d,9,22);

        const camera=new THREE.PerspectiveCamera(view==="face"?24:29,1,.1,100);
        const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance"});
        renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
        renderer.outputColorSpace=THREE.SRGBColorSpace;
        renderer.toneMapping=THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure=1.08;
        renderer.shadowMap.enabled=true;
        renderer.shadowMap.type=THREE.PCFSoftShadowMap;
        renderer.domElement.style.cssText="width:100%;height:100%;display:block;touch-action:none;cursor:grab;";
        mount.appendChild(renderer.domElement);

        scene.add(new THREE.HemisphereLight(0xeaf6ff,0x1b1420,1.65));
        const key=new THREE.DirectionalLight(0xffeadf,3.3);
        key.position.set(4.5,7.5,5.5);key.castShadow=true;key.shadow.mapSize.set(2048,2048);scene.add(key);
        const fill=new THREE.DirectionalLight(0x9bc7ff,1.35);fill.position.set(-4,4.5,4.5);scene.add(fill);
        const rim=new THREE.DirectionalLight(0x58d8ff,2.5);rim.position.set(-4.5,5,-5);scene.add(rim);

        const stage=new THREE.Mesh(
          new THREE.CylinderGeometry(2.15,2.35,.14,64),
          new THREE.MeshStandardMaterial({color:0x111827,roughness:.5,metalness:.22})
        );
        stage.position.y=.02;stage.receiveShadow=true;scene.add(stage);

        const loader=new GLTFLoader();
        const gltf=await loader.loadAsync(character.modelPath);
        if(disposed)return;

        const avatar=new THREE.Group();
        scene.add(avatar);
        const model=gltf.scene;
        avatar.add(model);

        // Character colors are fixed per roster entry. Students cannot edit them.
        model.traverse((obj:any)=>{
          if(!obj.isMesh)return;
          obj.castShadow=true;obj.receiveShadow=true;
          const original=obj.material;
          if(!original)return;
          const materials=Array.isArray(original)?original:[original];
          const next=materials.map((material:any)=>{
            const m=material.clone();
            const name=String(m.name||"").toLowerCase();
            if(m.color){
              if(name.includes("skin"))m.color.set(character.skin);
              else if(name.includes("hair")||name.includes("brown"))m.color.set(character.hairColor);
              else if(name.includes("eye"))m.color.set(character.eyeColor);
              else if(name.includes("blue")||name.includes("shirt")||name.includes("cloth"))m.color.set(character.palette.top);
              else if(name.includes("gold"))m.color.set(character.palette.accent);
              else if(name.includes("beige"))m.color.set(character.palette.trim);
            }
            m.roughness=Math.max(.42,Number(m.roughness??.65));
            return m;
          });
          obj.material=Array.isArray(original)?next:next[0];
        });

        // Normalize every different source model to the same Fortnite-like character-select stage.
        const rawBox=new THREE.Box3().setFromObject(model);
        const rawSize=rawBox.getSize(new THREE.Vector3());
        const rawCenter=rawBox.getCenter(new THREE.Vector3());
        const targetHeight=compact?4.15:4.75;
        const scale=targetHeight/Math.max(.001,rawSize.y);
        model.scale.setScalar(scale);
        model.position.set(-rawCenter.x*scale,-rawBox.min.y*scale+.09,-rawCenter.z*scale);

        const box=new THREE.Box3().setFromObject(model);
        const size=box.getSize(new THREE.Vector3());
        const center=box.getCenter(new THREE.Vector3());
        const minDim=Math.min(size.x,size.z);
        const topY=box.max.y;
        const frontZ=box.max.z;

        // Local A.R.I.S.E. accessories layered over the fixed base character.
        // Head-worn items are anchored to the actual rigged Head bone instead of
        // guessing from the full-body bounds. This keeps hats, glasses and
        // headphones fitted to every character and moving with the idle animation.
        const accessoryRoot=new THREE.Group();
        avatar.add(accessoryRoot);
        const darkMat=new THREE.MeshPhysicalMaterial({color:0x111827,roughness:.48,metalness:.12});
        const cyanMat=new THREE.MeshPhysicalMaterial({color:0x38d9e6,roughness:.28,metalness:.28});
        const silverMat=new THREE.MeshPhysicalMaterial({color:0xd7dee8,roughness:.2,metalness:.82});
        const goldMat=new THREE.MeshPhysicalMaterial({color:0xf4c34f,roughness:.23,metalness:.68});

        model.updateMatrixWorld(true);
        const headBone=model.getObjectByName("Head");
        let headMesh:any=null;
        model.traverse((obj:any)=>{
          if(!headMesh&&obj.isMesh&&/_Head$/i.test(String(obj.name||"")))headMesh=obj;
        });

        const headWorldBox=headMesh
          ? new THREE.Box3().setFromObject(headMesh,true)
          : new THREE.Box3(
              new THREE.Vector3(center.x-size.x*.13,topY-size.y*.19,center.z-size.z*.13),
              new THREE.Vector3(center.x+size.x*.13,topY,center.z+size.z*.13),
            );
        const headWorldSize=headWorldBox.getSize(new THREE.Vector3());
        const headWorldCenter=headWorldBox.getCenter(new THREE.Vector3());

        let headParent:any=accessoryRoot;
        let headCenter=new THREE.Vector3(center.x,topY-size.y*.095,center.z);
        let headTopY=topY;
        let faceZ=frontZ;
        let headRadius=Math.max(.16,Math.min(size.x*.19,size.y*.075));
        let headHeight=Math.max(headRadius*1.7,size.y*.15);

        if(headBone){
          headParent=headBone;
          const worldScale=headBone.getWorldScale(new THREE.Vector3());
          const safeX=Math.max(.001,Math.abs(worldScale.x));
          const safeY=Math.max(.001,Math.abs(worldScale.y));

          headCenter=headBone.worldToLocal(headWorldCenter.clone());
          const topLocal=headBone.worldToLocal(new THREE.Vector3(headWorldCenter.x,headWorldBox.max.y,headWorldCenter.z));
          const faceLocal=headBone.worldToLocal(new THREE.Vector3(headWorldCenter.x,headWorldCenter.y,headWorldBox.max.z));

          headRadius=Math.max(.045,(headWorldSize.x/safeX)*.52);
          headHeight=Math.max(headRadius*1.65,headWorldSize.y/safeY);
          headTopY=topLocal.y;
          faceZ=faceLocal.z;
        }

        const eyeY=headCenter.y+headHeight*.08;

        if(equipped.hat==="hat-cap"){
          const capHeight=headRadius*.34;
          const cap=new THREE.Mesh(new THREE.CylinderGeometry(headRadius*.88,headRadius,capHeight,40),darkMat);
          cap.position.set(headCenter.x,headTopY+capHeight*.16,headCenter.z);
          headParent.add(cap);

          const billDepth=headRadius*.72;
          const bill=new THREE.Mesh(new THREE.BoxGeometry(headRadius*1.34,headRadius*.13,billDepth),darkMat);
          bill.position.set(headCenter.x,headTopY-headRadius*.02,faceZ+headRadius*.25);
          headParent.add(bill);
        }else if(equipped.hat==="hat-beanie"){
          const beanie=new THREE.Mesh(new THREE.SphereGeometry(headRadius*1.04,40,28),darkMat);
          beanie.position.set(headCenter.x,headTopY+headRadius*.04,headCenter.z);
          beanie.scale.set(1,.60,.94);
          headParent.add(beanie);
        }else if(equipped.hat==="hat-crown"){
          const crownHeight=headRadius*.78;
          const crown=new THREE.Mesh(new THREE.CylinderGeometry(headRadius*.70,headRadius*.91,crownHeight,8,1,true),goldMat);
          crown.position.set(headCenter.x,headTopY+crownHeight*.38,headCenter.z);
          crown.rotation.y=Math.PI/8;
          headParent.add(crown);
        }

        if(equipped.glasses){
          const frameMat=equipped.glasses==="glasses-shades"?darkMat:silverMat;
          const spacing=headRadius*.49;
          const r=headRadius*.30;
          for(const x of [headCenter.x-spacing,headCenter.x+spacing]){
            const ring=new THREE.Mesh(new THREE.TorusGeometry(r,r*.09,8,30),frameMat);
            ring.position.set(x,eyeY,faceZ+headRadius*.035);
            headParent.add(ring);
          }
          const bridge=new THREE.Mesh(new THREE.BoxGeometry(spacing*.55,r*.10,r*.08),frameMat);
          bridge.position.set(headCenter.x,eyeY,faceZ+headRadius*.035);
          headParent.add(bridge);
        }

        if(equipped.accessory==="headphones-cyan"){
          const phones=new THREE.Mesh(new THREE.TorusGeometry(headRadius*1.12,headRadius*.12,12,48,Math.PI),cyanMat);
          phones.position.set(headCenter.x,headCenter.y+headHeight*.14,headCenter.z);
          headParent.add(phones);
        }else if(equipped.accessory==="chain-silver"){
          const chain=new THREE.Mesh(new THREE.TorusGeometry(size.x*.16,size.x*.012,10,48,Math.PI),silverMat);
          chain.position.set(center.x,topY-size.y*.245,frontZ+headRadius*.08);chain.rotation.x=Math.PI/2;chain.rotation.z=Math.PI;chain.scale.y=1.25;accessoryRoot.add(chain);
        }else if(equipped.accessory==="watch-smart"){
          const watch=new THREE.Mesh(new THREE.BoxGeometry(size.x*.065,size.y*.035,size.z*.06),darkMat);
          watch.position.set(box.max.x-size.x*.06,topY-size.y*.48,frontZ);accessoryRoot.add(watch);
        }else if(equipped.accessory==="bag-tech"){
          const bag=new THREE.Mesh(new THREE.BoxGeometry(size.x*.42,size.y*.24,size.z*.22),darkMat);
          bag.position.set(center.x,topY-size.y*.40,box.min.z-size.z*.06);accessoryRoot.add(bag);
        }

        // Use the source model's real rigged idle animation.
        let mixer:any=null;
        if(gltf.animations?.length){
          mixer=new THREE.AnimationMixer(model);
          const idle=gltf.animations.find((clip:any)=>clip.name==="Idle_Neutral")
            ||gltf.animations.find((clip:any)=>clip.name==="Idle")
            ||gltf.animations[0];
          mixer.clipAction(idle).play();
        }

        // Camera framing stays inside the viewer and starts head-to-toe.
        const targetY=view==="face"?topY-size.y*.105:center.y;
        let distance=view==="face"
          ? Math.max(1.6,size.y*.36)
          : Math.max(5.3,size.y*1.40);
        const minDistance=view==="face"?Math.max(1.1,size.y*.28):Math.max(4.2,size.y*1.08);
        const maxDistance=view==="face"?Math.max(3.6,size.y*.72):Math.max(9.5,size.y*2.05);
        camera.position.set(0,targetY,distance);
        camera.lookAt(0,targetY,0);

        let dragging=false,lastX=0,yaw=0;
        const down=(e:PointerEvent)=>{dragging=true;lastX=e.clientX;renderer.domElement.style.cursor="grabbing";renderer.domElement.setPointerCapture?.(e.pointerId);};
        const move=(e:PointerEvent)=>{if(!dragging)return;const dx=e.clientX-lastX;lastX=e.clientX;yaw+=dx*.008;};
        const stop=()=>{dragging=false;renderer.domElement.style.cursor="grab";};
        const wheel=(e:WheelEvent)=>{e.preventDefault();e.stopPropagation();distance=Math.min(maxDistance,Math.max(minDistance,distance+e.deltaY*.0025));};
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
          const next=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
          if(pinch)distance=Math.min(maxDistance,Math.max(minDistance,distance+(pinch-next)*.007));
          pinch=next;
        };
        renderer.domElement.addEventListener("touchstart",touchStart,{passive:false});
        renderer.domElement.addEventListener("touchmove",touchMove,{passive:false});

        const resize=()=>{
          const w=Math.max(1,mount.clientWidth),h=Math.max(1,mount.clientHeight);
          renderer.setSize(w,h,false);
          camera.aspect=w/h;
          camera.updateProjectionMatrix();
        };
        const ro=new ResizeObserver(resize);ro.observe(mount);resize();

        const clock=new THREE.Clock();
        let frame=0;
        const render=()=>{
          if(disposed)return;
          const delta=Math.min(.05,clock.getDelta());
          mixer?.update(delta);
          avatar.rotation.y=yaw;
          camera.position.z+=(distance-camera.position.z)*.13;
          camera.lookAt(0,targetY,0);
          renderer.render(scene,camera);
          frame=requestAnimationFrame(render);
        };
        render();
        setStatus("ready");

        cleanup=()=>{
          cancelAnimationFrame(frame);
          ro.disconnect();
          mixer?.stopAllAction?.();
          renderer.dispose();
          scene.traverse((obj:any)=>{
            obj.geometry?.dispose?.();
            const mats=Array.isArray(obj.material)?obj.material:[obj.material];
            mats.filter(Boolean).forEach((m:any)=>m.dispose?.());
          });
          if(mount.contains(renderer.domElement))mount.removeChild(renderer.domElement);
        };
      }catch(error){
        console.error("[ARISE game character]",error);
        if(!disposed)setStatus("error");
      }
    };

    void boot();
    return()=>{disposed=true;cleanup();};
  },[characterId,equipped.hat,equipped.glasses,equipped.accessory,compact,view]);

  return <div ref={hostRef} className={"relative overflow-hidden "+className} aria-label={"Interactive 3D character: "+character.name}>
    <div data-canvas-host className="absolute inset-0"/>
    {status==="loading"&&<div className="absolute inset-0 z-20 grid place-items-center bg-slate-950">
      <div className="text-center"><div className="w-10 h-10 border-4 border-cyan-300 border-t-transparent rounded-full animate-spin mx-auto"/><p className="mt-3 text-sm font-black text-white/70">Loading {character.name}…</p></div>
    </div>}
    {status==="error"&&<div className="absolute inset-0 z-20 grid place-items-center bg-slate-950 p-6">
      <div className="text-center"><p className="font-black">Character model did not load.</p><button type="button" onClick={()=>window.location.reload()} className="mt-3 rounded-xl bg-white text-slate-950 px-4 py-2 font-black">Reload</button></div>
    </div>}
    {controls&&status==="ready"&&<div className="absolute left-3 top-3 z-10 flex gap-2 rounded-2xl bg-slate-950/75 backdrop-blur p-1.5 border border-white/10">
      <button type="button" onClick={()=>setView("full")} className={"rounded-xl px-3 py-2 text-xs font-black "+(view==="full"?"bg-white text-slate-950":"text-white/70")}>FULL BODY</button>
      <button type="button" onClick={()=>setView("face")} className={"rounded-xl px-3 py-2 text-xs font-black "+(view==="face"?"bg-white text-slate-950":"text-white/70")}>FACE</button>
    </div>}
    {controls&&status==="ready"&&<div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 rounded-full bg-slate-950/70 backdrop-blur px-4 py-2 text-[11px] font-black text-white/70 border border-white/10 whitespace-nowrap">
      Drag to rotate · Scroll/pinch to zoom
    </div>}
  </div>;
}
