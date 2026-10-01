import * as THREE from "three";

export const HALLOREAD_ACTIVE = (() => {
  try {
    const now = new Date();
    return now.getMonth() === 9 || (now.getMonth() === 10 && now.getDate() <= 2);
  } catch {
    return false;
  }
})();

export type HalloreadSceneKind = "board" | "arcade" | "neighborhood" | "theater";

function standard(color:number, emissive=0x000000, emissiveIntensity=0){
  return new THREE.MeshStandardMaterial({color,roughness:.62,metalness:.08,emissive,emissiveIntensity});
}

function pumpkin(scale=.72){
  const group=new THREE.Group();
  const bodyMat=standard(0xf97316,0x7c2d12,.42);
  for(const x of [-.22,0,.22]){
    const lobe=new THREE.Mesh(new THREE.SphereGeometry(.48,18,14),bodyMat);
    lobe.scale.set(.78,1,.82);lobe.position.x=x;group.add(lobe);
  }
  const stem=new THREE.Mesh(new THREE.CylinderGeometry(.08,.11,.35,8),standard(0x365314));
  stem.position.y=.58;stem.rotation.z=.14;group.add(stem);
  const eyeMat=new THREE.MeshBasicMaterial({color:0xffdf75});
  for(const x of [-.18,.18]){
    const eye=new THREE.Mesh(new THREE.ConeGeometry(.085,.16,3),eyeMat);
    eye.rotation.z=Math.PI;eye.position.set(x,.12,.43);group.add(eye);
  }
  const mouth=new THREE.Mesh(new THREE.BoxGeometry(.34,.055,.025),eyeMat);
  mouth.position.set(0,-.14,.47);mouth.rotation.z=.08;group.add(mouth);
  group.scale.setScalar(scale);
  return group;
}

function bat(scale=.75){
  const group=new THREE.Group();
  const body=new THREE.Mesh(new THREE.SphereGeometry(.16,10,8),new THREE.MeshStandardMaterial({color:0x09050d,roughness:.8}));
  body.scale.set(.7,1.5,.65);group.add(body);
  for(const side of [-1,1]){
    const shape=new THREE.Shape();
    shape.moveTo(0,0);shape.lineTo(side*.72,.23);shape.lineTo(side*.53,-.08);shape.lineTo(side*.82,-.24);shape.lineTo(side*.32,-.18);shape.lineTo(0,0);
    const wing=new THREE.Mesh(new THREE.ShapeGeometry(shape),new THREE.MeshBasicMaterial({color:0x100719,side:THREE.DoubleSide}));
    wing.position.z=.02;group.add(wing);
  }
  group.scale.setScalar(scale);
  return group;
}

function web(radius=1.8){
  const root=new THREE.Group();
  const material=new THREE.LineBasicMaterial({color:0xd8c8ff,transparent:true,opacity:.55});
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4;
    const g=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0),new THREE.Vector3(Math.cos(a)*radius,Math.sin(a)*radius,0)]);
    root.add(new THREE.Line(g,material));
  }
  for(const r of [radius*.28,radius*.52,radius*.76,radius]){
    const points:THREE.Vector3[]=[];
    for(let i=0;i<=32;i++){const a=i/32*Math.PI*2;points.push(new THREE.Vector3(Math.cos(a)*r,Math.sin(a)*r,0));}
    root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),material));
  }
  return root;
}

function ghost(scale=.9){
  const group=new THREE.Group();
  const body=new THREE.Mesh(new THREE.SphereGeometry(.48,18,14,0,Math.PI*2,0,Math.PI*.65),new THREE.MeshStandardMaterial({color:0xf8fafc,roughness:.88,transparent:true,opacity:.82,emissive:0xb9d8ff,emissiveIntensity:.18}));
  body.scale.y=1.35;body.position.y=.38;group.add(body);
  const skirt=new THREE.Mesh(new THREE.ConeGeometry(.48,.9,18,1,true),new THREE.MeshStandardMaterial({color:0xf8fafc,side:THREE.DoubleSide,transparent:true,opacity:.76,emissive:0xb9d8ff,emissiveIntensity:.15}));
  skirt.position.y=-.25;skirt.rotation.z=Math.PI;group.add(skirt);
  const eyeMat=new THREE.MeshBasicMaterial({color:0x171020});
  for(const x of [-.15,.15]){const e=new THREE.Mesh(new THREE.SphereGeometry(.055,8,6),eyeMat);e.position.set(x,.48,.42);group.add(e);}
  group.scale.setScalar(scale);return group;
}

function textSprite(text:string,bg="#15051f",fg="#ffb24a"){
  const canvas=document.createElement("canvas");canvas.width=768;canvas.height=160;
  const ctx=canvas.getContext("2d")!;ctx.fillStyle=bg;ctx.fillRect(0,0,768,160);
  ctx.strokeStyle="#7c3aed";ctx.lineWidth=10;ctx.strokeRect(5,5,758,150);
  ctx.fillStyle=fg;ctx.font="900 52px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(text,384,80);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false}));
  sprite.scale.set(8.8,1.84,1);return sprite;
}

function addPumpkins(root:THREE.Object3D,positions:Array<[number,number,number,number?]>){
  positions.forEach(([x,y,z,s])=>{const p=pumpkin(s??.72);p.position.set(x,y,z);root.add(p);});
}

function addBats(root:THREE.Object3D,positions:Array<[number,number,number,number?]>){
  positions.forEach(([x,y,z,s])=>{const b=bat(s??.75);b.position.set(x,y,z);b.rotation.z=(x+z)*.08;root.add(b);});
}

export function addHalloreadSceneDecor(scene:THREE.Scene,kind:HalloreadSceneKind){
  if(!HALLOREAD_ACTIVE||scene.userData.halloreadDecor)return;
  scene.userData.halloreadDecor=true;
  const root=new THREE.Group();root.name="halloreadDecor";scene.add(root);

  const amber=new THREE.PointLight(0xff7a18,kind==="board"?5.5:3.4,kind==="neighborhood"?34:22,1.7);
  amber.position.set(-7,6,2);root.add(amber);
  const violet=new THREE.PointLight(0x8b5cf6,kind==="board"?4.8:3,kind==="neighborhood"?32:22,1.6);
  violet.position.set(8,7,-5);root.add(violet);

  if(kind==="board"){
    addPumpkins(root,[[-24,0,-18,1.2],[24,0,-18,1.05],[-24,0,19,.9],[24,0,19,.9],[-12,0,25,.75],[12,0,25,.75]]);
    addBats(root,[[-13,15,-12,1.4],[10,17,-18,1.25],[20,13,8,1.15],[-20,12,12,1.1]]);
    for(const [x,z] of [[-29,-8],[29,-8],[-29,10],[29,10]] as [number,number][]){
      const w=web(2.7);w.position.set(x,6,z);w.rotation.y=x<0?Math.PI/2:-Math.PI/2;root.add(w);
    }
    for(const x of [-15,0,15]){
      const sentinel=new THREE.Group();
      const metal=standard(0x31283d,0x150e20,.12);
      const torso=new THREE.Mesh(new THREE.BoxGeometry(1.25,1.75,.85),metal);torso.position.y=2.05;sentinel.add(torso);
      const head=new THREE.Mesh(new THREE.SphereGeometry(.65,14,10),metal);head.position.y=3.38;sentinel.add(head);
      for(const ex of [-.22,.22]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.065,8,6),new THREE.MeshBasicMaterial({color:0xff6b35}));eye.position.set(ex,3.45,.61);sentinel.add(eye);}
      for(const sx of [-.78,.78]){const arm=new THREE.Mesh(new THREE.CylinderGeometry(.13,.16,1.7,10),metal);arm.position.set(sx,2.05,0);arm.rotation.z=sx<0?.22:-.22;sentinel.add(arm);}
      sentinel.position.set(x,0,-31);sentinel.rotation.y=Math.PI;root.add(sentinel);
    }
    const sign=textSprite("HALLOREAD · MIDNIGHT MYSTERY");sign.position.set(0,12,-34);root.add(sign);
    const moon=new THREE.Mesh(new THREE.SphereGeometry(4.6,26,18),new THREE.MeshBasicMaterial({color:0xe9d5ff}));
    moon.position.set(-30,31,-72);root.add(moon);
  }else if(kind==="arcade"){
    addPumpkins(root,[[-14,0,-18,.9],[14,0,-18,.9],[-18,0,10,.7],[18,0,10,.7],[-5,0,19,.65],[5,0,19,.65]]);
    addBats(root,[[-13,8,-14,1],[12,9,-9,.9],[0,10,11,1.2]]);
    for(const [x,z,rot] of [[-25,-16,Math.PI/2],[25,-16,-Math.PI/2],[-25,13,Math.PI/2],[25,13,-Math.PI/2]] as [number,number,number][]){const w=web(2.2);w.position.set(x,5,z);w.rotation.y=rot;root.add(w);}
    const sign=textSprite("HALLOREAD ARCADE");sign.position.set(0,9.3,-20.2);root.add(sign);
  }else if(kind==="neighborhood"){
    addPumpkins(root,[[-26,0,-8,.65],[-18,0,7,.7],[-10,0,-8,.6],[-2,0,7,.65],[6,0,-8,.7],[14,0,7,.62],[22,0,-8,.7],[30,0,7,.65]]);
    addBats(root,[[-20,13,-10,1.1],[-7,15,7,.9],[9,14,-5,1.1],[23,16,8,.85]]);
    for(const x of [-28,-14,0,14,28]){
      const lantern=new THREE.PointLight(0xff8a24,1.7,11,1.9);lantern.position.set(x,3.8,0);root.add(lantern);
    }
    const moon=new THREE.Mesh(new THREE.SphereGeometry(5.2,24,18),new THREE.MeshBasicMaterial({color:0xf3e8ff}));
    moon.position.set(-35,30,-55);root.add(moon);
  }else{
    addPumpkins(root,[[-11,0,-5.4,.72],[11,0,-5.4,.72],[-11,0,18,.68],[11,0,18,.68],[-6.2,0,25,.55],[6.2,0,25,.55]]);
    addBats(root,[[-9,8,-4,.85],[9,8,-4,.85],[-7,8.5,21,.8],[7,8.5,21,.8]]);
    for(const [x,z,rot] of [[-12.8,-6,Math.PI/2],[12.8,-6,-Math.PI/2],[-12.8,24,Math.PI/2],[12.8,24,-Math.PI/2]] as [number,number,number][]){const w=web(1.6);w.position.set(x,6.5,z);w.rotation.y=rot;root.add(w);}
    const floating=ghost(.72);floating.position.set(9,5.5,24.5);root.add(floating);
  }
}

export function addHalloreadHomeDecor(root:THREE.Group,seed:number,facing=0){
  if(!HALLOREAD_ACTIVE)return;
  const decor=new THREE.Group();decor.name="halloreadHomeDecor";decor.rotation.y=facing;
  addPumpkins(decor,[[-1.55,0,3.35,.58],[1.55,0,3.35,.58]]);
  const w=web(1.15);w.position.set(2.1,3.8,2.8);w.rotation.y=Math.PI;decor.add(w);
  const g=ghost(.42);g.position.set(-2.2,3.1,2.9);decor.add(g);
  if(seed%2===0){const b=bat(.62);b.position.set(0,4.65,3);decor.add(b);}
  root.add(decor);
}

export function halloreadPetGearName(petId:string|null|undefined){
  if(!HALLOREAD_ACTIVE||!petId||petId==="pet-none")return "";
  const code=Array.from(petId).reduce((n,c)=>n+c.charCodeAt(0),0)%3;
  return code===0?"Midnight Witch Hat":code===1?"Pumpkin Charm":"Little Bat Wings";
}

export function addHalloreadPetGear(root:THREE.Group,petId:string|null|undefined,height=1){
  const name=halloreadPetGearName(petId);if(!name)return;
  const code=Array.from(petId).reduce((n,c)=>n+c.charCodeAt(0),0)%3;
  const gear=new THREE.Group();gear.name="halloreadPetGear";gear.userData.gearName=name;
  if(code===0){
    const brim=new THREE.Mesh(new THREE.CylinderGeometry(.27,.3,.045,18),standard(0x241033,0x4c1d95,.35));brim.position.y=height*1.03;gear.add(brim);
    const cone=new THREE.Mesh(new THREE.ConeGeometry(.23,.55,18),standard(0x36124e,0x6d28d9,.28));cone.position.y=height*1.32;cone.rotation.z=-.12;gear.add(cone);
    const band=new THREE.Mesh(new THREE.TorusGeometry(.19,.035,8,20),new THREE.MeshBasicMaterial({color:0xff8a24}));band.rotation.x=Math.PI/2;band.position.y=height*1.11;gear.add(band);
  }else if(code===1){
    const charm=pumpkin(.22);charm.position.set(0,height*.63,height*.45);gear.add(charm);
    const collar=new THREE.Mesh(new THREE.TorusGeometry(.22,.035,8,20),new THREE.MeshBasicMaterial({color:0x7c3aed}));collar.rotation.x=Math.PI/2;collar.position.y=height*.68;gear.add(collar);
  }else{
    for(const side of [-1,1]){
      const shape=new THREE.Shape();shape.moveTo(0,0);shape.lineTo(side*.48,.2);shape.lineTo(side*.38,-.12);shape.lineTo(side*.58,-.28);shape.lineTo(0,-.18);shape.lineTo(0,0);
      const wing=new THREE.Mesh(new THREE.ShapeGeometry(shape),new THREE.MeshStandardMaterial({color:0x1f102b,emissive:0x4c1d95,emissiveIntensity:.25,side:THREE.DoubleSide}));
      wing.position.set(0,height*.68,-.12);wing.rotation.x=-.35;gear.add(wing);
    }
  }
  root.add(gear);
}
