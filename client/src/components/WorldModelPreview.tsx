import { useEffect,useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createWorldModel } from "@/lib/worldModels";
import { createPet } from "@/lib/pets";

export default function WorldModelPreview({id,className=""}:{id:string;className?:string}){
  const mountRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const mount=mountRef.current;if(!mount)return;
    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(42,1,.1,100);camera.position.set(5,4.2,7);
    const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.6));
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xffffff,0x475569,2.3));
    const light=new THREE.DirectionalLight(0xffffff,2.4);light.position.set(-4,8,5);scene.add(light);
    const model=id.startsWith("pet-")?createPet(id,new GLTFLoader(),2.4):createWorldModel(id,new GLTFLoader(),4.5);
    if(model)scene.add(model);
    const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.enablePan=false;
    controls.minDistance=4;controls.maxDistance=14;controls.target.set(0,id.startsWith("home-")||id.startsWith("pet-")?1.1:.7,0);
    const resize=()=>{const w=mount.clientWidth,h=mount.clientHeight;camera.aspect=w/Math.max(1,h);camera.updateProjectionMatrix();renderer.setSize(w,h);};
    resize();const observer=new ResizeObserver(resize);observer.observe(mount);
    let frame=0;const draw=()=>{controls.update();renderer.render(scene,camera);frame=requestAnimationFrame(draw);};draw();
    return()=>{cancelAnimationFrame(frame);observer.disconnect();controls.dispose();renderer.dispose();if(renderer.domElement.parentElement===mount)mount.removeChild(renderer.domElement);};
  },[id]);
  return <div ref={mountRef} className={className} aria-label="Drag to rotate the 3D model"/>;
}
