import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// Kenney Cube Pets, CC0: https://kenney.nl/assets/cube-pets
export const PET_MODELS: Record<string, string> = {
  "pet-dog": "/pets/dog.glb",
  "pet-cat": "/pets/cat.glb",
  "pet-bunny": "/pets/bunny.glb",
};

export function createPet(petId: string | null | undefined, loader: GLTFLoader, height: number) {
  const path = petId && PET_MODELS[petId];
  if (!path) return null;
  const root = new THREE.Group();
  root.name = "clubPet";
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
