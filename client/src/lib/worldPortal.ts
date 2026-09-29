import * as THREE from "three";

/** A visible exit that can be found and selected inside a 3D world. */
export function createWorldExit(scene:THREE.Scene,x:number,z:number,color=0x22d3ee){
  const portal=new THREE.Group();portal.name="worldExit";portal.position.set(x,0,z);portal.userData.worldExit=true;
  const frame=new THREE.Mesh(new THREE.BoxGeometry(3.5,4.8,.55),new THREE.MeshStandardMaterial({color:0x102036,metalness:.55,roughness:.32}));
  frame.position.y=2.4;portal.add(frame);
  const opening=new THREE.Mesh(new THREE.PlaneGeometry(2.65,3.8),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.32,side:THREE.DoubleSide,depthWrite:false}));
  opening.position.set(0,2.4,.31);portal.add(opening);
  const glow=new THREE.Mesh(new THREE.TorusGeometry(1.92,.12,12,64,Math.PI),new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:2.5}));
  glow.position.set(0,2.3,.36);portal.add(glow);
  const lintel=new THREE.Mesh(new THREE.BoxGeometry(3.55,.24,.7),new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:1.5}));lintel.position.set(0,4.8,.35);portal.add(lintel);
  const canvas=document.createElement("canvas");canvas.width=512;canvas.height=128;
  const ctx=canvas.getContext("2d")!;ctx.fillStyle="#061427";ctx.beginPath();ctx.roundRect(8,12,496,104,24);ctx.fill();ctx.fillStyle="#ffffff";ctx.font="bold 42px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("EXIT · WORLDS",256,64);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const sign=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false}));sign.position.set(0,5.7,0);sign.scale.set(4.5,1.12,1);portal.add(sign);
  const hit=new THREE.Mesh(new THREE.BoxGeometry(4.5,6,2),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));hit.position.y=2.7;hit.userData.worldExit=true;portal.add(hit);
  scene.add(portal);return portal;
}
