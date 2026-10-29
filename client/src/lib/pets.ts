import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { addHalloreadPetGear } from "@/lib/halloread";

// The pets' data lives in lib/petInfo.ts (no 3D code), so the app's first load doesn't carry three.js.
import { PET_MODELS } from "@/lib/petInfo";
export { PET_MODELS, PET_PERSONALITIES, PET_CARE_EVENT, openPetCare } from "@/lib/petInfo";

export function findPetRoot(object: THREE.Object3D | null | undefined): THREE.Object3D | null {
  let node: THREE.Object3D | null = object || null;
  while (node) {
    if (node.name === "clubPet") return node;
    node = node.parent;
  }
  return null;
}

export function createPet(petId: string | null | undefined, loader: GLTFLoader, height: number) {
  const path = petId && PET_MODELS[petId];
  if (!path) return null;
  const root = new THREE.Group();
  root.name = "clubPet";
  root.userData.petId = petId;
  addHalloreadPetGear(root, petId, height);
  loader.load(path, gltf => {
    const model = gltf.scene;
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    model.scale.setScalar(height / Math.max(.001, size.y));
    model.updateMatrixWorld(true);
    const normalized = new THREE.Box3().setFromObject(model);
    model.position.set(-bounds.getCenter(new THREE.Vector3()).x * model.scale.x, -normalized.min.y, -bounds.getCenter(new THREE.Vector3()).z * model.scale.z);
    model.traverse(object => {
      if ((object as THREE.Mesh).isMesh) {
        (object as THREE.Mesh).castShadow = true;
        (object as THREE.Mesh).receiveShadow = true;
      }
    });
    root.add(model);
  }, undefined, error => console.error("Pet model did not load", path, error));
  return root;
}
