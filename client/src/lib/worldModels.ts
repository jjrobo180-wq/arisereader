import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// Kenney Car Kit and City Kit (Suburban), both CC0 1.0.
export const CAR_MODELS:Record<string,string>={
  "car-street":"/world/sedan.glb",
  "car-electric":"/world/hatchback-sports.glb",
  "car-super":"/world/race-future.glb",
  "car-suv":"/world/suv.glb",
};
export const HOME_MODELS:Record<string,string>={
  "home-basic":"/world/building-type-a.glb",
  "home-studio":"/world/building-type-b.glb",
  "home-loft":"/world/building-type-c.glb",
  "home-modern":"/world/building-type-d.glb",
};

export function createWorldModel(id:string,loader:GLTFLoader,width:number){
  const path=CAR_MODELS[id]||HOME_MODELS[id];
  const root=new THREE.Group();
  if(!path)return root;
  loader.load(path,gltf=>{
    const model=gltf.scene;
    const original=new THREE.Box3().setFromObject(model);
    const size=original.getSize(new THREE.Vector3());
    model.scale.setScalar(width/Math.max(.001,size.x,size.z));
    model.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(model);
    const center=bounds.getCenter(new THREE.Vector3());
    model.position.set(-center.x,-bounds.min.y,-center.z);
    model.traverse(object=>{if((object as THREE.Mesh).isMesh){(object as THREE.Mesh).castShadow=true;(object as THREE.Mesh).receiveShadow=true;}});
    root.add(model);
  },undefined,error=>console.error("World model did not load",path,error));
  return root;
}
