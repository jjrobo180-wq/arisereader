import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// Kenney Cube Pets, CC0: https://kenney.nl/assets/cube-pets
export const PET_MODELS: Record<string, string> = {
  "pet-dog": "/pets/dog.glb",
  "pet-cat": "/pets/cat.glb",
  "pet-bunny": "/pets/bunny.glb",
  "pet-fox": "/pets/animal-fox.glb",
  "pet-panda": "/pets/animal-panda.glb",
  "pet-penguin": "/pets/animal-penguin.glb",
  "pet-lion": "/pets/animal-lion.glb",
  "pet-koala": "/pets/animal-koala.glb",
  "pet-elephant": "/pets/animal-elephant.glb",
  "pet-parrot": "/pets/animal-parrot.glb",
  "pet-pig": "/pets/animal-pig.glb",
  "pet-deer": "/pets/animal-deer.glb",
};

export const PET_PERSONALITIES: Record<string,{emoji:string;trait:string;favorite:string;greeting:string;motion:"bounce"|"sway"|"spin"}> = {
  "pet-dog":{emoji:"🐶",trait:"Loyal and energetic",favorite:"Running beside you",greeting:"Adventure? I'm ready!",motion:"bounce"},
  "pet-cat":{emoji:"🐱",trait:"Curious and clever",favorite:"Finding secret corners",greeting:"Let's investigate!",motion:"sway"},
  "pet-bunny":{emoji:"🐰",trait:"Gentle and quick",favorite:"Hopping to new stories",greeting:"Hop along with me!",motion:"bounce"},
  "pet-fox":{emoji:"🦊",trait:"Witty and adventurous",favorite:"Solving riddles",greeting:"I smell a mystery!",motion:"spin"},
  "pet-panda":{emoji:"🐼",trait:"Calm and cuddly",favorite:"Quiet reading time",greeting:"Let's read together.",motion:"sway"},
  "pet-penguin":{emoji:"🐧",trait:"Brave and playful",favorite:"Waddling to the dance floor",greeting:"Let's slide into a story!",motion:"sway"},
  "pet-lion":{emoji:"🦁",trait:"Bold and encouraging",favorite:"Cheering for every quiz",greeting:"You can do it!",motion:"bounce"},
  "pet-koala":{emoji:"🐨",trait:"Dreamy and thoughtful",favorite:"Cozy book nooks",greeting:"One page at a time.",motion:"sway"},
  "pet-elephant":{emoji:"🐘",trait:"Wise and kind",favorite:"Remembering favorite tales",greeting:"Tell me what you learned!",motion:"bounce"},
  "pet-parrot":{emoji:"🦜",trait:"Chatty and musical",favorite:"Singing at the club",greeting:"Read, dance, repeat!",motion:"spin"},
  "pet-pig":{emoji:"🐷",trait:"Silly and friendly",favorite:"Making new friends",greeting:"Oink! What's next?",motion:"bounce"},
  "pet-deer":{emoji:"🦌",trait:"Shy and observant",favorite:"Exploring gently",greeting:"Can we explore together?",motion:"sway"},
};

export function createPet(petId: string | null | undefined, loader: GLTFLoader, height: number) {
  const path = petId && PET_MODELS[petId];
  if (!path) return null;
  const root = new THREE.Group();
  root.name = "clubPet";
  root.userData.petId = petId;
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
