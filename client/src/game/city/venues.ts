// The busy-city layer: restaurants on the plaza (and their dining rooms), the
// Neon Arcade, Haven Fairgrounds with rideable rides, the elevated Haven Loop
// train, storefronts and rooftop water tanks downtown, street furniture and
// steam vents. Rides and the train animate in update().
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  ARCADE, BEACH_SHOPS, BIG_TOP, BOOTHS, BUMPER, CABINETS, COUNTER, FAIR, FOOD_STANDS, INTERIORS, RESTAURANTS, RIDES, ROADS, ROAD_HALF, TABLES, TOWERS, TRAIN, TRAIN_PILLARS,
  cabinetPos, isNS, rng,
} from "@shared/city/layout";
import { signTexture } from "./textures";

const std = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.05, ...extra });
function boxAt(w: number, h: number, d: number, x: number, y: number, z: number, rotY = 0) { const g = new THREE.BoxGeometry(w, h, d); if (rotY) g.rotateY(rotY); g.translate(x, y + h / 2, z); return g; }
function cyl(rt: number, rb: number, h: number, x: number, y: number, z: number, seg = 12) { const g = new THREE.CylinderGeometry(rt, rb, h, seg); g.translate(x, y + h / 2, z); return g; }
function flat(w: number, d: number, x: number, z: number, y: number) { const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2); g.translate(x, y, z); return g; }

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat = true) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const brickTex = () => canvasTex(256, 256, (g) => {
  g.fillStyle = "#6e2f22"; g.fillRect(0, 0, 256, 256);
  const r = rng(51);
  for (let row = 0; row < 16; row++) for (let col = 0; col < 8; col++) {
    const x = col * 32 + (row % 2) * 16, y = row * 16;
    g.fillStyle = `hsl(${10 + r() * 10}, ${40 + r() * 15}%, ${26 + r() * 12}%)`;
    g.fillRect(x + 1, y + 1, 30, 14);
  }
});
const shopWindowTex = () => canvasTex(512, 128, (g) => {
  // a row of lit shop windows with shelves and silhouettes
  const r = rng(77);
  g.fillStyle = "#1b1410"; g.fillRect(0, 0, 512, 128);
  for (let i = 0; i < 8; i++) {
    const x = i * 64;
    const hue = [38, 45, 200, 30, 330, 50, 180, 20][i];
    const grad = g.createLinearGradient(0, 10, 0, 118);
    grad.addColorStop(0, `hsl(${hue}, 70%, 78%)`); grad.addColorStop(1, `hsl(${hue}, 60%, 45%)`);
    g.fillStyle = grad; g.fillRect(x + 4, 12, 56, 100);
    g.fillStyle = "rgba(40,25,15,.55)";
    for (let k = 0; k < 3; k++) g.fillRect(x + 6, 40 + k * 24, 52, 3);
    for (let k = 0; k < 5; k++) { g.fillRect(x + 8 + r() * 44, 22 + Math.floor(r() * 3) * 24, 6, 14); }
    g.fillStyle = "#2a1d14"; g.fillRect(x, 0, 4, 128);
  }
  g.fillStyle = "#2a1d14"; g.fillRect(0, 0, 512, 10); g.fillRect(0, 114, 512, 14);
});
const neon = (color: number) => new THREE.MeshBasicMaterial({ color });

export type Venues = {
  update: (t: number, dt: number) => void;
  /** World position (and look direction) of the seat on a ride, for the ride camera. */
  rideSeat: (id: "wheel" | "carousel" | "drop") => { pos: THREE.Vector3; look: THREE.Vector3 };
  trainCars: () => THREE.Object3D[];
  /** Shows one indoor room (or none when you're outside). */
  showRoom: (id: string | null) => void;
};

export function buildVenues(scene: THREE.Scene, keep: <T extends { dispose: () => void }>(o: T) => T): Venues {
  // everything goes into the scene, except each indoor room, which gets its own group so it can be hidden
  let parent: THREE.Object3D = scene;
  const rooms = new Map<string, THREE.Group>();
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, opts: { cast?: boolean } = {}) => { keep(geo); const m = new THREE.Mesh(geo, mat); m.castShadow = !!opts.cast; m.receiveShadow = true; parent.add(m); return m; };
  const merged = (list: THREE.BufferGeometry[], mat: THREE.Material, cast = false) => { if (!list.length) return null; const m = add(mergeGeometries(list)!, mat, { cast }); list.forEach((g) => g.dispose()); return m; };
  const sign = (tex: THREE.Texture, w: number, h: number, x: number, y: number, z: number, rotY: number, twoSided = false) => {
    const mat = keep(new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    for (const flip of twoSided ? [0, Math.PI] : [0]) { const p = new THREE.Mesh(keep(new THREE.PlaneGeometry(w, h)), mat); p.position.set(x, y, z); p.rotation.y = rotY + flip; parent.add(p); }
  };
  const hex = (c: number) => "#" + c.toString(16).padStart(6, "0");
  const dark = keep(std(0x23252c, { metalness: 0.4, roughness: 0.5 }));
  const metal = keep(std(0x9aa3b5, { metalness: 0.8, roughness: 0.35 }));
  const wood = keep(std(0x7a4b2a));
  const white = keep(std(0xf1f3f5));
  const glassWarm = keep(new THREE.MeshStandardMaterial({ color: 0x3a2a18, emissive: 0xffc078, emissiveIntensity: 0.7, roughness: 0.15, metalness: 0.3 }));
  const updaters: ((t: number, dt: number) => void)[] = [];

  // ═══ Downtown dressing: storefronts, water tanks, billboards ═══
  {
    const shop = keep(shopWindowTex());
    const bands: THREE.BufferGeometry[] = [];
    for (const t of TOWERS) {
      const w = t.maxX - t.minX, d = t.maxZ - t.minZ, x = (t.minX + t.maxX) / 2, z = (t.minZ + t.maxZ) / 2;
      const g = new THREE.BoxGeometry(w + 0.12, 4.2, d + 0.12);
      const uv = g.getAttribute("uv") as THREE.BufferAttribute;
      const fw = [d, d, 0, 0, w, w];
      for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) { const i = f * 4 + v; if (f === 2 || f === 3) { uv.setXY(i, 0, 0); continue; } uv.setXY(i, uv.getX(i) * (fw[f] / 24), uv.getY(i)); }
      g.translate(x, 2.1, z); bands.push(g);
    }
    merged(bands, keep(new THREE.MeshStandardMaterial({ map: shop, emissiveMap: shop, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.4 })));
    // NYC-style wooden water tanks on the taller roofs, plus rooftop vents
    const tanks: THREE.BufferGeometry[] = [], legs: THREE.BufferGeometry[] = [], roofs: THREE.BufferGeometry[] = [];
    const r = rng(909);
    for (const t of TOWERS) {
      if (t.height < 40 || r() < 0.45) continue;
      const x = (t.minX + t.maxX) / 2 + (r() - 0.5) * 3, z = (t.minZ + t.maxZ) / 2 + (r() - 0.5) * 3, y = t.height + 1.6;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) legs.push(boxAt(0.25, 3, 0.25, x + sx * 1.4, y, z + sz * 1.4));
      tanks.push(cyl(2, 2, 3.6, x, y + 3, z, 16));
      const cone = new THREE.ConeGeometry(2.15, 1.4, 16); cone.translate(x, y + 7.3, z); roofs.push(cone);
    }
    merged(tanks, keep(std(0x8a6a48, { roughness: 0.95 })), true);
    merged(legs, dark);
    merged(roofs, keep(std(0x4a3a2c)));
    // billboards on a few tall towers
    const boards = [
      { text: "READ MORE. RISE HIGHER.", sub: "A.R.I.S.E. READER", bg: "#111827", c: "#facc15" },
      { text: "NOODLE HOUSE", sub: "ON THE PLAZA · OPEN LATE", bg: "#14532d", c: "#bbf7d0" },
      { text: "HAVEN FAIR", sub: "RIDES · GAMES · TREATS", bg: "#7c2d12", c: "#fed7aa" },
      { text: "ARISE NEWS", sub: "WORLD NEWS YOU CAN READ", bg: "#1e1b4b", c: "#c7d2fe" },
    ];
    const tall = [...TOWERS].sort((a, b) => b.height - a.height).slice(0, boards.length);
    tall.forEach((t, i) => {
      const b = boards[i], tex = keep(signTexture([{ text: b.text, size: 92, color: b.c }, { text: b.sub, size: 44, color: "#ffffff" }], { w: 1024, h: 340, bg: b.bg }));
      const z = t.maxZ + 0.2, x = (t.minX + t.maxX) / 2, w = Math.min(t.maxX - t.minX - 2, 16);
      sign(tex, w, w * 0.33, x, t.height * 0.72, z, 0);
    });
  }

  // ═══ Street furniture along downtown sidewalks: hydrants, bins, news boxes ═══
  {
    const hydrant = keep(mergeGeometries([cyl(0.22, 0.26, 0.8, 0, 0, 0, 10), cyl(0.28, 0.28, 0.12, 0, 0.8, 0, 10), new THREE.SphereGeometry(0.2, 10, 6).translate(0, 0.95, 0)])!);
    const bin = keep(cyl(0.38, 0.32, 1.0, 0, 0, 0, 12));
    const newsbox = keep(new THREE.BoxGeometry(0.6, 1.1, 0.5).translate(0, 0.55, 0));
    const spots: { x: number; z: number; k: number }[] = [];
    const r = rng(333);
    for (const road of ROADS) {
      const ns = isNS(road), a0 = ns ? road.z1 : road.x1, a1 = ns ? road.z2 : road.x2, pos = ns ? road.x1 : road.z1;
      if (Math.abs(pos) > 210 || (ns ? road.z2 < -460 : false)) continue;
      for (let a = a0 + 9; a < a1 - 9; a += 23) {
        const side = r() < 0.5 ? -1 : 1, off = side * (ROAD_HALF + 1.3);
        const x = ns ? pos + off : a, z = ns ? a : pos + off;
        if (Math.abs(x) < 36 && Math.abs(z) < 36) continue;
        spots.push({ x, z, k: Math.floor(r() * 3) });
      }
    }
    const kinds = [{ g: hydrant, m: keep(std(0xc92a2a, { roughness: 0.5 })) }, { g: bin, m: keep(std(0x2f3b2f)) }, { g: newsbox, m: keep(std(0x1c64b8, { roughness: 0.5 })) }];
    kinds.forEach((kd, k) => {
      const list = spots.filter((s) => s.k === k);
      const im = new THREE.InstancedMesh(kd.g, kd.m, list.length);
      const m4 = new THREE.Matrix4();
      list.forEach((s, i) => { m4.makeTranslation(s.x, 0, s.z); im.setMatrixAt(i, m4); });
      im.castShadow = true; parent.add(im);
    });
  }

  // ═══ Steam rising from street vents downtown (one draw call for every puff) ═══
  {
    const puffTex = keep(canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,.75)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }, false));
    const vents = [[-37, -70], [43, -95], [-117, -60], [123, -150], [3, -126], [-43, -170]];
    const PER = 7, n = vents.length * PER;
    const pos = new Float32Array(n * 3);
    const geo = keep(new THREE.BufferGeometry()); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, keep(new THREE.PointsMaterial({ map: puffTex, size: 5, transparent: true, opacity: 0.6, depthWrite: false, sizeAttenuation: true })));
    pts.frustumCulled = false; parent.add(pts);
    merged(vents.map(([x, z]) => flat(1.6, 1.6, x, z, 0.065)), keep(std(0x1a1a1a, { metalness: 0.6 })));
    updaters.push((t) => {
      vents.forEach(([x, z], vi) => {
        for (let k = 0; k < PER; k++) {
          const f = (t * 0.32 + k / PER + vi * 0.13) % 1, i = (vi * PER + k) * 3;
          pos[i] = x + Math.sin(t + k * 1.7 + vi) * 0.5 * f; pos[i + 1] = 0.4 + f * 6.5; pos[i + 2] = z + Math.cos(t * 0.7 + k) * 0.3 * f;
        }
      });
      geo.attributes.position.needsUpdate = true;
    });
  }

  // ═══ Plaza restaurants ═══
  {
    const brick = keep(brickTex());
    const brickMat = keep(std(0xffffff, { map: brick, roughness: 0.95 }));
    for (const r of RESTAURANTS) {
      const b = r.box, w = b.maxX - b.minX, d = b.maxZ - b.minZ;
      add(boxAt(w, 7.5, d, r.x, 0, r.z), brickMat, { cast: true });
      add(boxAt(w + 0.6, 0.6, d + 0.6, r.x, 7.5, r.z), dark);
      const faceX = r.side < 0 ? b.maxX + 0.06 : b.minX - 0.06, rot = r.side < 0 ? Math.PI / 2 : -Math.PI / 2;
      // big warm window and a door
      const win = new THREE.Mesh(keep(new THREE.PlaneGeometry(d * 0.75, 3)), glassWarm); win.position.set(faceX, 2.2, r.z + (r.z < 0 ? -1.2 : 1.2) * 0); win.rotation.y = rot; parent.add(win);
      const doorM = new THREE.Mesh(keep(new THREE.PlaneGeometry(1.8, 2.6)), keep(std(0x2b1d14))); doorM.position.set(faceX + (r.side < 0 ? 0.01 : -0.01), 1.3, r.z); doorM.rotation.y = rot; parent.add(doorM);
      // striped awning
      const stripes: THREE.BufferGeometry[] = [], stripes2: THREE.BufferGeometry[] = [];
      for (let i = 0; i < 8; i++) { const g = new THREE.BoxGeometry(2.4, 0.12, d / 8); g.rotateZ(r.side < 0 ? -0.35 : 0.35); g.translate(faceX - r.side * 1.1, 4.1, b.minZ + (i + 0.5) * (d / 8)); (i % 2 ? stripes2 : stripes).push(g); }
      merged(stripes, keep(std(r.color))); merged(stripes2, white);
      const tex = keep(signTexture([{ text: r.name.toUpperCase(), size: 96, color: "#ffffff" }, { text: r.sign, size: 56, color: hex(r.color) }], { w: 1024, h: 260, bg: "#111111", border: hex(r.color) }));
      sign(tex, d * 0.82, 2.1, faceX - r.side * 0.02, 5.9, r.z, rot);
      // outdoor table with an umbrella
      const tx = faceX - r.side * 4, tz = r.z + (r.z < 0 ? -3.5 : 3.5);
      merged([cyl(0.6, 0.6, 0.06, tx, 0.75, tz, 14), cyl(0.06, 0.06, 0.75, tx, 0, tz, 6), cyl(0.04, 0.04, 2.4, tx, 0, tz, 6)], dark);
      const umb = new THREE.Mesh(keep(new THREE.ConeGeometry(1.6, 0.6, 10)), keep(std(r.color))); umb.position.set(tx, 2.5, tz); umb.castShadow = true; parent.add(umb);
    }
  }

  // ═══ Neon Arcade sign on the boardwalk shop ═══
  {
    const shop = BEACH_SHOPS.find((b) => b.name === "Arcade Pier")!;
    const tex = keep(signTexture([{ text: "NEON ARCADE", size: 120, color: "#ff5fd8" }, { text: "PLAY · WIN · REPEAT", size: 50, color: "#3ee6ff" }], { w: 1024, h: 280, bg: "#0b0820", border: "#3ee6ff" }));
    sign(tex, 13, 3.6, ARCADE.door.x + 1.5, 8.6, shop.z, -Math.PI / 2);
    const tube = new THREE.Mesh(keep(new THREE.BoxGeometry(0.15, 0.15, 14)), keep(neon(0xff5fd8))); tube.position.set(ARCADE.door.x + 1.45, 6.6, shop.z); parent.add(tube);
    updaters.push((t) => { (tube.material as THREE.MeshBasicMaterial).color.setHSL((t * 0.1) % 1, 1, 0.6); });
  }

  // ═══ Indoor rooms ═══
  for (const room of INTERIORS) {
    const roomGroup = new THREE.Group(); roomGroup.visible = false; scene.add(roomGroup); rooms.set(room.id, roomGroup); parent = roomGroup;
    const { x, z, w, d } = room;
    const restaurant = RESTAURANTS.find((r) => r.id === room.id);
    const accent = restaurant?.color ?? 0xff5fd8;
    const floorTex = keep(canvasTex(128, 128, (g) => {
      // classic arcade carpet: deep navy with tiny neon squiggles and stars
      if (room.kind === "arcade") {
        g.fillStyle = "#0d0a1f"; g.fillRect(0, 0, 128, 128); const r = rng(5);
        g.lineWidth = 1.4; g.lineCap = "round";
        for (let i = 0; i < 26; i++) {
          g.strokeStyle = ["#a3367f", "#2a8fa8", "#a8901f", "#5b3fb0"][i % 4];
          const x = r() * 128, y = r() * 128, a = r() * 6.28;
          g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * 6, y + Math.sin(a) * 6, x + Math.cos(a + 1) * 9, y + Math.sin(a + 1) * 9); g.stroke();
        }
        for (let i = 0; i < 14; i++) { g.fillStyle = ["#b2457f", "#3a9fb8"][i % 2]; g.fillRect(r() * 128, r() * 128, 2, 2); }
      }
      else { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? "#f1f3f5" : "#212529"; g.fillRect(i * 32, j * 32, 32, 32); } }
    }));
    floorTex.repeat.set(room.kind === "arcade" ? w / 2.5 : w / 4, room.kind === "arcade" ? d / 2.5 : d / 4);
    add(flat(w, d, x, z, 0.01), keep(std(0xffffff, { map: floorTex, roughness: 0.6 })));
    const wallMat = keep(std(room.kind === "arcade" ? 0x1a1433 : 0xf3e6d0));
    const walls = [boxAt(w, 6, 0.6, x, 0, z - d / 2), boxAt(w, 6, 0.6, x, 0, z + d / 2), boxAt(0.6, 6, d, x - w / 2, 0, z), boxAt(0.6, 6, d, x + w / 2, 0, z)];
    merged(walls, wallMat);
    add(boxAt(w, 0.3, d, x, 6, z), keep(std(room.kind === "arcade" ? 0x0b0820 : 0xffffff)));
    // ceiling lights
    const lamps: THREE.BufferGeometry[] = [];
    for (let i = -1; i <= 1; i++) for (const j of [-1, 1]) lamps.push(boxAt(2.2, 0.08, 0.6, x + i * 6, 5.9, z + j * 4));
    merged(lamps, keep(neon(room.kind === "arcade" ? 0xb197fc : 0xfff4d6)));
    // exit door
    const doorMesh = new THREE.Mesh(keep(new THREE.PlaneGeometry(2, 2.8)), keep(std(0x3b2a1e))); doorMesh.position.set(x, 1.4, z + d / 2 - 0.31); doorMesh.rotation.y = Math.PI; parent.add(doorMesh);
    const exitTex = keep(signTexture([{ text: "EXIT", size: 140, color: "#2f9e44" }], { w: 512, h: 200, bg: "#0b0b0b" }));
    sign(exitTex, 1.4, 0.55, x, 3.3, z + d / 2 - 0.32, Math.PI);
    if (restaurant) {
      // wainscot, framed pictures, pendant lamps over the tables and plants by the door
      const accentDark = new THREE.Color(accent).multiplyScalar(0.55).getHex();
      merged([boxAt(w - 1.2, 1.1, 0.1, x, 0, z - d / 2 + 0.36), boxAt(0.1, 1.1, d - 1.2, x - w / 2 + 0.36, 0, z), boxAt(0.1, 1.1, d - 1.2, x + w / 2 - 0.36, 0, z)], keep(std(accentDark, { roughness: 0.6 })));
      merged([boxAt(w - 1.2, 0.08, 0.16, x, 1.1, z - d / 2 + 0.38), boxAt(0.16, 0.08, d - 1.2, x - w / 2 + 0.38, 1.1, z), boxAt(0.16, 0.08, d - 1.2, x + w / 2 - 0.38, 1.1, z)], wood);
      for (const [side, dz, k] of [[-1, -2.5, 0], [-1, 3.5, 1], [1, -2.5, 2], [1, 3.5, 3]]) {
        const art = keep(canvasTex(128, 96, (g) => {
          const r = rng(room.x + k * 7);
          const sky = g.createLinearGradient(0, 0, 0, 96); sky.addColorStop(0, `hsl(${200 + r() * 40},60%,${60 + r() * 15}%)`); sky.addColorStop(1, `hsl(${20 + r() * 30},70%,75%)`);
          g.fillStyle = sky; g.fillRect(0, 0, 128, 96);
          g.fillStyle = `hsl(${30 + r() * 30},80%,60%)`; g.beginPath(); g.arc(30 + r() * 70, 30, 10, 0, 7); g.fill();
          for (let i = 0; i < 3; i++) { g.fillStyle = `hsl(${100 + r() * 80},${30 + r() * 20}%,${25 + i * 10}%)`; g.beginPath(); g.moveTo(0, 96); for (let xx = 0; xx <= 128; xx += 16) g.lineTo(xx, 50 + i * 12 + r() * 16); g.lineTo(128, 96); g.fill(); }
        }, false));
        const fx = x + side * (w / 2 - 0.34);
        add(boxAt(0.08, 1.5, 2.0, fx, 2.4, z + dz), dark);
        const pic = new THREE.Mesh(keep(new THREE.PlaneGeometry(1.8, 1.3)), keep(new THREE.MeshStandardMaterial({ map: art, roughness: 0.7 }))); pic.position.set(fx - side * 0.05, 3.15, z + dz); pic.rotation.y = -side * Math.PI / 2; parent.add(pic);
      }
      const cords: THREE.BufferGeometry[] = [], shades: THREE.BufferGeometry[] = [];
      for (const t of TABLES(room)) { cords.push(cyl(0.015, 0.015, 2.2, t.x, 3.8, t.z, 4)); const sh = new THREE.ConeGeometry(0.45, 0.4, 16, 1, true); sh.translate(t.x, 3.8, t.z); shades.push(sh); }
      merged(cords, dark); merged(shades, keep(new THREE.MeshStandardMaterial({ color: accent, emissive: 0xffd8a0, emissiveIntensity: 0.5, side: THREE.DoubleSide })));
      const pot = keep(std(0xb5651d)), leaf = keep(std(0x2f9e44, { flatShading: true }));
      for (const sx of [-1, 1]) {
        const px = x + sx * (w / 2 - 1.2), pz = z + d / 2 - 1.2;
        add(cyl(0.38, 0.3, 0.6, px, 0, pz, 12), pot);
        const bush = new THREE.Mesh(keep(new THREE.IcosahedronGeometry(0.7, 0)), leaf); bush.position.set(px, 1.25, pz); bush.scale.y = 1.3; bush.castShadow = true; parent.add(bush);
      }
      const c = COUNTER(room);
      add(boxAt(c.maxX - c.minX, 1.1, c.maxZ - c.minZ, x, 0, (c.minZ + c.maxZ) / 2), keep(std(accent, { roughness: 0.5 })), { cast: true });
      add(boxAt(c.maxX - c.minX + 0.3, 0.08, c.maxZ - c.minZ + 0.3, x, 1.1, (c.minZ + c.maxZ) / 2), keep(std(0xdee2e6, { metalness: 0.4, roughness: 0.3 })));
      const menuTex = keep(signTexture([{ text: restaurant.name.toUpperCase(), size: 70, color: hex(accent) }, ...restaurant.menu.map((m) => ({ text: m, size: 46, color: "#ffffff" }))], { w: 1024, h: 600, bg: "#1b1b1b", border: hex(accent) }));
      sign(menuTex, 7, 4.1, x, 3.6, z - d / 2 + 0.32, 0);
      // themed decor behind the counter
      if (restaurant.id === "pizza") { const oven = new THREE.Mesh(keep(new THREE.SphereGeometry(1.6, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2)), brickMatFor()); oven.position.set(x + 6.5, 1, z - d / 2 + 1.8); parent.add(oven); const fire = new THREE.Mesh(keep(new THREE.CircleGeometry(0.5, 12)), keep(neon(0xff922b))); fire.position.set(x + 6.5, 1.4, z - d / 2 + 3.3); parent.add(fire); }
      if (restaurant.id === "noodles") for (let i = 0; i < 4; i++) { const lan = new THREE.Mesh(keep(new THREE.SphereGeometry(0.45, 12, 10)), keep(neon(0xff6b6b))); lan.scale.y = 1.3; lan.position.set(x - 7 + i * 4.6, 4.9, z + 2); parent.add(lan); }
      if (restaurant.id === "diner") { const juke = new THREE.Mesh(keep(new THREE.BoxGeometry(1.4, 2, 0.9)), keep(new THREE.MeshStandardMaterial({ color: 0xc92a2a, emissive: 0xff6b6b, emissiveIntensity: 0.4 }))); juke.position.set(x - w / 2 + 1.2, 1, z + 2); parent.add(juke); }
      if (restaurant.id === "tacos") for (let i = 0; i < 6; i++) { const f = new THREE.Mesh(keep(new THREE.PlaneGeometry(1.4, 1)), keep(new THREE.MeshBasicMaterial({ color: [0xe03131, 0xf59f00, 0x2f9e44, 0x1c7ed6, 0xae3ec9, 0xfcc419][i], side: THREE.DoubleSide }))); f.position.set(x - 8 + i * 3.2, 5.2, z - 1); parent.add(f); }
      // tables and chairs
      const tops: THREE.BufferGeometry[] = [], legs: THREE.BufferGeometry[] = [], seats: THREE.BufferGeometry[] = [];
      for (const t of TABLES(room)) {
        tops.push(cyl(1.15, 1.15, 0.08, t.x, 0.85, t.z, 18)); legs.push(cyl(0.12, 0.3, 0.85, t.x, 0, t.z, 8));
        for (const [dx, dz] of [[0, 1.7], [0, -1.7], [1.7, 0], [-1.7, 0]]) { seats.push(boxAt(0.7, 0.5, 0.7, t.x + dx, 0, t.z + dz)); seats.push(boxAt(0.7, 0.7, 0.1, t.x + dx, 0.5, t.z + dz + Math.sign(dz) * 0.3)); }
      }
      merged(tops, white, true); merged(legs, dark); merged(seats, keep(std(accent)));
    } else {
      // arcade cabinets with glowing screens
      CABINETS.forEach((c, i) => {
        const p = cabinetPos(room, i);
        const g = new THREE.Group(); g.position.set(p.x, 0, p.z); g.rotation.y = p.facing; parent.add(g);
        const body = new THREE.Mesh(keep(new THREE.BoxGeometry(1.3, 2.2, 1.1)), keep(std([0x1c1440, 0x2b0a3d, 0x0a2a3d][i % 3]))); body.position.y = 1.1; g.add(body);
        const scr = keep(signTexture([{ text: c.title.toUpperCase(), size: 110, color: ["#3ee6ff", "#ff5fd8", "#ffd43b", "#8ce99a"][i % 4] }, { text: "PRESS START", size: 50, color: "#ffffff" }], { w: 512, h: 400, bg: "#05030f" }));
        const screen = new THREE.Mesh(keep(new THREE.PlaneGeometry(1, 0.8)), keep(new THREE.MeshBasicMaterial({ map: scr }))); screen.position.set(0, 1.55, 0.56); screen.rotation.x = -0.12; g.add(screen);
        const marquee = new THREE.Mesh(keep(new THREE.BoxGeometry(1.3, 0.3, 0.3)), keep(neon([0xff5fd8, 0x3ee6ff, 0xffd43b][i % 3]))); marquee.position.set(0, 2.25, 0.4); g.add(marquee);
        const panel = new THREE.Mesh(keep(new THREE.BoxGeometry(1.2, 0.12, 0.5)), dark); panel.position.set(0, 1.05, 0.7); panel.rotation.x = 0.3; g.add(panel);
      });
      const strip = new THREE.Mesh(keep(new THREE.BoxGeometry(w - 1, 0.1, 0.1)), keep(neon(0x3ee6ff))); strip.position.set(x, 5.6, z - d / 2 + 0.4); parent.add(strip);
      // the middle of the floor: an air hockey table and two claw machines
      add(boxAt(2.4, 0.85, 4.2, x, 0, z + 1.5), keep(std(0x1c1440)), { cast: true });
      add(flat(2.2, 4, x, z + 1.5, 0.87), keep(new THREE.MeshStandardMaterial({ color: 0x0b3d91, emissive: 0x1c7ed6, emissiveIntensity: 0.6, roughness: 0.2 })));
      merged([boxAt(2.5, 0.12, 0.12, x, 0.85, z + 1.5 - 2.1), boxAt(2.5, 0.12, 0.12, x, 0.85, z + 1.5 + 2.1), boxAt(0.12, 0.12, 4.3, x - 1.2, 0.85, z + 1.5), boxAt(0.12, 0.12, 4.3, x + 1.2, 0.85, z + 1.5)], keep(neon(0xff5fd8)));
      const puck = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.14, 0.14, 0.04, 16)), keep(neon(0xffd43b))); puck.position.set(x, 0.9, z + 1.5); parent.add(puck);
      updaters.push((t) => { puck.position.x = x + Math.sin(t * 2.3) * 0.9; puck.position.z = z + 1.5 + Math.sin(t * 1.7 + 1) * 1.7; });
      const glass = keep(new THREE.MeshStandardMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.1 }));
      for (const sx of [-1, 1]) {
        const cx = x + sx * 5, cz = z - 3.5;
        add(boxAt(1.7, 1.1, 1.7, cx, 0, cz), keep(std(sx < 0 ? 0xe03131 : 0x1c7ed6, { roughness: 0.4 })), { cast: true });
        add(boxAt(1.6, 1.4, 1.6, cx, 1.1, cz), glass);
        add(boxAt(1.7, 0.4, 1.7, cx, 2.5, cz), keep(neon(sx < 0 ? 0xffd43b : 0xff5fd8)));
        const prizes: THREE.BufferGeometry[] = [];
        const pr = rng(cx);
        for (let i = 0; i < 9; i++) prizes.push(new THREE.SphereGeometry(0.2, 10, 8).translate(cx + (pr() - 0.5) * 1.1, 1.3 + pr() * 0.15, cz + (pr() - 0.5) * 1.1));
        merged(prizes, keep(std([0xf783ac, 0x74c0fc, 0x8ce99a][sx < 0 ? 0 : 1], { roughness: 0.9 })));
        const claw = new THREE.Mesh(keep(new THREE.ConeGeometry(0.16, 0.3, 6)), metal); claw.position.set(cx, 2.2, cz); parent.add(claw);
        updaters.push((t) => { claw.position.x = cx + Math.sin(t * 0.7 + sx) * 0.5; claw.position.y = 2.05 + Math.max(0, Math.sin(t * 0.9 + sx)) * -0.5; });
      }
      const tex = keep(signTexture([{ text: "NEON ARCADE", size: 130, color: "#ff5fd8" }], { w: 1024, h: 220, bg: "#05030f" }));
      sign(tex, 10, 2.1, x, 4.2, z - d / 2 + 0.32, 0);
    }
  }
  parent = scene;
  // one room light, moved to whichever room you're in (a fixed light count keeps shaders from recompiling)
  const roomLight = new THREE.PointLight(0xffe3b0, 0, 30, 1.6); scene.add(roomLight);
  function brickMatFor() { return keep(std(0x8a3b2a, { roughness: 0.95 })); }

  // ═══ Haven Fairgrounds ═══
  const seats: Record<string, THREE.Object3D> = {};
  {
    const { minX, maxX, minZ, maxZ } = FAIR, cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
    // trampled grass with wide sawdust midways
    const grassTex = keep(canvasTex(128, 128, (g) => { g.fillStyle = "#5a7a38"; g.fillRect(0, 0, 128, 128); const r = rng(8); for (let i = 0; i < 700; i++) { g.fillStyle = `hsla(${78 + r() * 24},${34 + r() * 12}%,${27 + r() * 8}%,0.7)`; g.fillRect(r() * 128, r() * 128, 1, 2 + r() * 2); } }));
    grassTex.repeat.set((maxX - minX) / 8, (maxZ - minZ) / 8);
    add(flat(maxX - minX, maxZ - minZ, cx, cz, 0.015), keep(std(0xffffff, { map: grassTex, roughness: 1 })));
    const dustTex = keep(canvasTex(128, 128, (g) => { g.fillStyle = "#c8a874"; g.fillRect(0, 0, 128, 128); const r = rng(9); for (let i = 0; i < 400; i++) { g.fillStyle = `hsl(${30 + r() * 12},${35 + r() * 20}%,${50 + r() * 22}%)`; g.fillRect(r() * 128, r() * 128, 2, 2); } }));
    dustTex.repeat.set(12, 12);
    const paths: THREE.BufferGeometry[] = [flat(maxX - minX - 12, 18, cx, -255, 0.02), flat(16, maxZ - minZ - 16, 430, cz, 0.021), flat(maxX - minX - 12, 18, cx, -150, 0.022), flat(30, 12, minX + 15, FAIR.gate.z, 0.023), flat(60, 30, 380, -112, 0.024)];
    merged(paths, keep(std(0xffffff, { map: dustTex, roughness: 1 })));
    // gate
    const gateTex = keep(signTexture([{ text: "HAVEN FAIR", size: 150, color: "#ffd43b" }, { text: "RIDES · GAMES · TREATS", size: 54, color: "#ffffff" }], { w: 1024, h: 300, bg: "#7c2d12", border: "#ffd43b" }));
    sign(gateTex, 16, 4.6, FAIR.gate.x + 4, 9, FAIR.gate.z, Math.PI / 2, true);
    merged([boxAt(0.8, 11.5, 0.8, FAIR.gate.x + 4, 0, FAIR.gate.z - 8), boxAt(0.8, 11.5, 0.8, FAIR.gate.x + 4, 0, FAIR.gate.z + 8)], keep(std(0xc92a2a)), true);

    // the Big Wheel
    const wheel = RIDES.find((r) => r.id === "wheel")!, hub = 24, R = 20;
    const legs: THREE.BufferGeometry[] = [];
    for (const dx of [-3, 3]) for (const dz of [-12, 12]) { const a = new THREE.Vector3(wheel.x + dx, 0, wheel.z + dz), b = new THREE.Vector3(wheel.x + dx * 0.4, hub, wheel.z); const len = a.distanceTo(b); const g = new THREE.CylinderGeometry(0.4, 0.5, len, 8); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())); const m = a.clone().add(b).multiplyScalar(0.5); g.translate(m.x, m.y, m.z); legs.push(g); }
    merged(legs, white, true);
    const wheelG = new THREE.Group(); wheelG.position.set(wheel.x, hub, wheel.z); parent.add(wheelG);
    const rimMat = keep(neon(0xffd43b));
    for (const dx of [-1.4, 1.4]) { const rim = new THREE.Mesh(keep(new THREE.TorusGeometry(R, 0.3, 6, 72)), rimMat); rim.rotation.y = Math.PI / 2; rim.position.x = dx; wheelG.add(rim); }
    const spokes: THREE.BufferGeometry[] = [];
    const N = 16;
    for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2; for (const dx of [-1.4, 1.4]) { const g = new THREE.BoxGeometry(0.12, R, 0.12); g.translate(0, R / 2, 0); g.rotateX(a); g.translate(dx, 0, 0); spokes.push(g); } }
    const sp = new THREE.Mesh(keep(mergeGeometries(spokes)!), white); spokes.forEach((g) => g.dispose()); wheelG.add(sp);
    const gondolas: THREE.Object3D[] = [];
    const cabGeo = keep(new THREE.BoxGeometry(2.2, 1.8, 2)); cabGeo.translate(0, -1.4, 0);
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2, g = new THREE.Group(); g.position.set(0, Math.sin(a) * R, Math.cos(a) * R);
      const m = new THREE.Mesh(cabGeo, keep(std([0xe03131, 0x1c7ed6, 0xf59f00, 0x2f9e44][i % 4], { roughness: 0.4 }))); g.add(m);
      wheelG.add(g); gondolas.push(g);
    }
    seats.wheel = gondolas[0];
    updaters.push((t) => { wheelG.rotation.x = t * 0.09; for (const g of gondolas) g.rotation.x = -wheelG.rotation.x; });

    // the Carousel
    const car = RIDES.find((r) => r.id === "carousel")!;
    const base = new THREE.Group(); base.position.set(car.x, 0, car.z); parent.add(base);
    const deck = new THREE.Mesh(keep(new THREE.CylinderGeometry(car.r, car.r, 0.6, 32)), keep(std(0xe9c46a))); deck.position.y = 0.3; deck.receiveShadow = true; base.add(deck);
    const stripesTex = keep(canvasTex(256, 32, (g) => { for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? "#e03131" : "#fff5f5"; g.fillRect(i * 16, 0, 16, 32); } }));
    const roof = new THREE.Mesh(keep(new THREE.ConeGeometry(car.r + 1, 4, 32, 1, true)), keep(std(0xffffff, { map: stripesTex, side: THREE.DoubleSide }))); roof.position.set(car.x, 7.6, car.z); roof.castShadow = true; parent.add(roof);
    const pole = new THREE.Mesh(keep(new THREE.CylinderGeometry(1.2, 1.2, 6, 16)), keep(std(0xc92a2a))); pole.position.set(car.x, 3, car.z); parent.add(pole);
    const spinner = new THREE.Group(); base.add(spinner);
    const horses: THREE.Object3D[] = [];
    const horseBody = keep(mergeGeometries([new THREE.BoxGeometry(0.5, 0.6, 1.5), new THREE.BoxGeometry(0.4, 0.8, 0.4).translate(0, 0.5, 0.65), new THREE.BoxGeometry(0.35, 0.3, 0.6).translate(0, 0.85, 0.95)])!);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2, rr = car.r - 2;
      const holder = new THREE.Group(); holder.position.set(Math.cos(a) * rr, 0, Math.sin(a) * rr); holder.rotation.y = -a; spinner.add(holder);
      const p = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.06, 0.06, 6.6, 6)), metal); p.position.y = 3.6; holder.add(p);
      const hm = new THREE.Mesh(horseBody, keep(std([0xffffff, 0x343a40, 0xe9c46a, 0xc92a2a][i % 4], { roughness: 0.5 }))); hm.position.y = 1.6; holder.add(hm);
      horses.push(hm);
    }
    seats.carousel = horses[0];
    // turns so the horses go head first
    updaters.push((t) => { spinner.rotation.y = -t * 0.45; horses.forEach((h, i) => { h.position.y = 1.6 + Math.sin(t * 2 + i) * 0.35; }); });

    // the Sky Drop tower
    const drop = RIDES.find((r) => r.id === "drop")!;
    add(cyl(1.4, 1.8, 42, drop.x, 0, drop.z, 16), keep(std(0x495057, { metalness: 0.6, roughness: 0.4 })), { cast: true });
    const crown = new THREE.Mesh(keep(new THREE.CylinderGeometry(3, 3, 1.2, 16)), keep(neon(0xff5fd8))); crown.position.set(drop.x, 42.6, drop.z); parent.add(crown);
    const ring = new THREE.Group(); ring.position.set(drop.x, 1, drop.z); parent.add(ring);
    const ringMesh = new THREE.Mesh(keep(new THREE.TorusGeometry(3.2, 0.6, 8, 24)), keep(std(0xf59f00, { roughness: 0.4 }))); ringMesh.rotation.x = Math.PI / 2; ring.add(ringMesh);
    const seatMark = new THREE.Object3D(); seatMark.position.set(0, 0.8, 3.6); ring.add(seatMark); seats.drop = seatMark;
    updaters.push((t) => {
      const c = (t % 14) / 14; // slow climb, pause, fast drop, rest
      const y = c < 0.55 ? (c / 0.55) * 36 : c < 0.65 ? 36 : c < 0.72 ? 36 * (1 - ((c - 0.65) / 0.07) ** 2) : 0;
      ring.position.y = 1 + Math.max(0, y);
      ring.rotation.y = t * 0.2;
    });

    // bumper cars
    const bump = keep(std(0x343a40, { metalness: 0.6, roughness: 0.3 }));
    add(flat(BUMPER.w, BUMPER.d, BUMPER.x, BUMPER.z, 0.03), bump);
    merged([boxAt(BUMPER.w, 1, 0.5, BUMPER.x, 0, BUMPER.z - BUMPER.d / 2), boxAt(BUMPER.w, 1, 0.5, BUMPER.x, 0, BUMPER.z + BUMPER.d / 2), boxAt(0.5, 1, BUMPER.d, BUMPER.x - BUMPER.w / 2, 0, BUMPER.z), boxAt(0.5, 1, BUMPER.d, BUMPER.x + BUMPER.w / 2, 0, BUMPER.z)], keep(std(0xfcc419)));
    const minis: THREE.Mesh[] = [];
    for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.9, 1, 0.8, 14)), keep(std([0xe03131, 0x1c7ed6, 0x2f9e44, 0xae3ec9][i % 4], { roughness: 0.3 }))); m.position.y = 0.4; m.castShadow = true; parent.add(m); minis.push(m); }
    updaters.push((t) => minis.forEach((m, i) => { m.position.x = BUMPER.x + Math.sin(t * (0.5 + i * 0.07) + i * 2) * (BUMPER.w / 2 - 2); m.position.z = BUMPER.z + Math.cos(t * (0.6 + i * 0.05) + i) * (BUMPER.d / 2 - 2); m.rotation.y = t * (i % 2 ? 1 : -1); }));

    // game booths and food stands
    for (const b of BOOTHS) {
      merged([boxAt(12, 3, 5, b.x, 0, b.z)], keep(std(0xf8f0e3)), true);
      const awn: THREE.BufferGeometry[] = [], awn2: THREE.BufferGeometry[] = [];
      for (let i = 0; i < 6; i++) { const g = new THREE.BoxGeometry(2, 0.12, 2); g.rotateX(0.4); g.translate(b.x - 5 + i * 2, 3.4, b.z + 3); (i % 2 ? awn2 : awn).push(g); }
      merged(awn, keep(std(b.color))); merged(awn2, white);
      const tex = keep(signTexture([{ text: b.name.toUpperCase(), size: 110, color: hex(b.color) }], { w: 1024, h: 200, bg: "#fff9db", border: hex(b.color) }));
      sign(tex, 8, 1.6, b.x, 4.6, b.z + 2.55, 0);
      const prizes: THREE.BufferGeometry[] = [];
      for (let i = 0; i < 6; i++) prizes.push(new THREE.SphereGeometry(0.4, 10, 8).translate(b.x - 4 + i * 1.6, 2.2, b.z + 2.4));
      merged(prizes, keep(std([0xf783ac, 0x74c0fc, 0xffd43b][BOOTHS.indexOf(b) % 3], { roughness: 0.9 })));
    }
    for (const f of FOOD_STANDS) {
      merged([boxAt(5, 2.6, 5, f.x, 0, f.z)], keep(std(0xffffff)), true);
      const top = new THREE.Mesh(keep(new THREE.ConeGeometry(3.8, 1.6, 4)), keep(std(f.color))); top.position.set(f.x, 3.4, f.z); top.rotation.y = Math.PI / 4; parent.add(top);
      const tex = keep(signTexture([{ text: f.name.toUpperCase(), size: 100, color: hex(f.color) }], { w: 1024, h: 200, bg: "#ffffff" }));
      sign(tex, 4.6, 0.9, f.x + 2.56, 2.2, f.z, Math.PI / 2);
    }
    // the big top: a striped circus tent with a flag on top
    {
      const { x: tx, z: tz, r: tr } = BIG_TOP;
      const stripeTex = keep(canvasTex(512, 64, (g) => { for (let i = 0; i < 24; i++) { g.fillStyle = i % 2 ? "#fff5f5" : "#c92a2a"; g.fillRect(i * (512 / 24), 0, 512 / 24 + 1, 64); } }));
      const wall = new THREE.Mesh(keep(new THREE.CylinderGeometry(tr, tr, 5, 48, 1, true)), keep(std(0xffffff, { map: stripeTex, side: THREE.DoubleSide })));
      wall.position.set(tx, 2.5, tz); wall.castShadow = true; parent.add(wall);
      const roofT = keep(stripeTex.clone()); roofT.needsUpdate = true;
      const roof = new THREE.Mesh(keep(new THREE.ConeGeometry(tr + 1.2, 9, 48, 1, true)), keep(std(0xffffff, { map: roofT, side: THREE.DoubleSide })));
      roof.position.set(tx, 9.5, tz); roof.castShadow = true; parent.add(roof);
      add(cyl(0.12, 0.12, 4, tx, 14, tz, 6), dark);
      const flag = new THREE.Mesh(keep(new THREE.PlaneGeometry(2, 1.2)), keep(new THREE.MeshBasicMaterial({ color: 0xfcc419, side: THREE.DoubleSide }))); flag.position.set(tx + 1, 17.3, tz); parent.add(flag);
      updaters.push((t) => { flag.rotation.y = Math.sin(t * 2) * 0.4; });
      const door = new THREE.Mesh(keep(new THREE.PlaneGeometry(4, 3.8)), keep(std(0x1a0f0a))); door.position.set(tx - tr - 0.02, 1.9, tz); door.rotation.y = -Math.PI / 2; parent.add(door);
      const tt = keep(signTexture([{ text: "BIG TOP", size: 130, color: "#ffd43b" }, { text: "JUGGLERS · ACROBATS · CLOWNS", size: 46, color: "#ffffff" }], { w: 1024, h: 280, bg: "#7c2d12", border: "#ffd43b" }));
      sign(tt, 8, 2.2, tx - tr - 0.3, 5.6, tz, -Math.PI / 2);
    }
    // picnic tables by the food stands, and a balloon seller at the gate
    {
      const tops: THREE.BufferGeometry[] = [], benches: THREE.BufferGeometry[] = [];
      for (const [px, pz] of [[372, -140], [372, -120], [392, -248], [376, -212], [440, -175], [464, -150]]) {
        tops.push(boxAt(3.2, 0.12, 1.3, px, 0.8, pz)); tops.push(boxAt(0.15, 0.8, 1.1, px - 1.2, 0, pz)); tops.push(boxAt(0.15, 0.8, 1.1, px + 1.2, 0, pz));
        benches.push(boxAt(3.2, 0.1, 0.4, px, 0.45, pz - 1), boxAt(3.2, 0.1, 0.4, px, 0.45, pz + 1));
      }
      merged(tops, wood, true); merged(benches, wood);
      const balloons = new THREE.Group(); balloons.position.set(FAIR.gate.x + 8, 0, FAIR.gate.z + 6); parent.add(balloons);
      const bm = [0xe03131, 0x1c7ed6, 0xfcc419, 0x2f9e44, 0xae3ec9, 0xf783ac];
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2, rr = 0.6 + (i % 3) * 0.25, h = 3.4 + (i % 4) * 0.35;
        const b = new THREE.Mesh(keep(new THREE.SphereGeometry(0.35, 14, 10)), keep(std(bm[i % bm.length], { roughness: 0.25, metalness: 0.1 })));
        b.scale.y = 1.2; b.position.set(Math.cos(a) * rr, h, Math.sin(a) * rr); balloons.add(b);
        const str = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.01, 0.01, h - 1, 3)), white); str.position.set(Math.cos(a) * rr * 0.5, (h - 1) / 2 + 1, Math.sin(a) * rr * 0.5); balloons.add(str);
      }
      updaters.push((t) => { balloons.rotation.y = Math.sin(t * 0.6) * 0.15; });
    }
    // string lights between poles
    const poles: [number, number][] = [];
    for (let px = minX + 24; px < maxX - 10; px += 22) poles.push([px, -268], [px, -138]);
    merged(poles.map(([px, pz]) => cyl(0.12, 0.12, 6, px, 0, pz, 6)), dark);
    const bulbPos: THREE.Vector3[] = [];
    for (const row of [-268, -138]) {
      const rowPoles = poles.filter((p) => p[1] === row);
      for (let i = 0; i < rowPoles.length - 1; i++) for (let k = 0; k <= 10; k++) { const t = k / 10, x = rowPoles[i][0] + (rowPoles[i + 1][0] - rowPoles[i][0]) * t; bulbPos.push(new THREE.Vector3(x, 6 - Math.sin(t * Math.PI) * 1.4, row)); }
    }
    const bulbs = new THREE.InstancedMesh(keep(new THREE.SphereGeometry(0.16, 6, 5)), keep(new THREE.MeshBasicMaterial({ color: 0xffffff })), bulbPos.length);
    const m4 = new THREE.Matrix4(), col = new THREE.Color();
    bulbPos.forEach((p, i) => { m4.makeTranslation(p.x, p.y, p.z); bulbs.setMatrixAt(i, m4); bulbs.setColorAt(i, col.setHSL((i % 5) / 5, 0.9, 0.65)); });
    parent.add(bulbs);
    updaters.push((t) => { if (Math.floor(t * 2) % 2 === 0) return; bulbPos.forEach((_, i) => bulbs.setColorAt(i, col.setHSL(((i + Math.floor(t * 2)) % 5) / 5, 0.9, 0.65))); if (bulbs.instanceColor) bulbs.instanceColor.needsUpdate = true; });
  }

  // ═══ The Haven Loop: elevated track and train ═══
  const trainCars: THREE.Object3D[] = [];
  {
    const y = TRAIN.y;
    merged(TRAIN_PILLARS.map((p) => cyl(0.55, 0.65, y, p.x, 0, p.z, 10)), keep(std(0x5c4b3a, { metalness: 0.5, roughness: 0.6 })), true);
    const deck: THREE.BufferGeometry[] = [], rails: THREE.BufferGeometry[] = [];
    const pts = TRAIN.loop;
    for (let i = 0; i < pts.length; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % pts.length];
      const len = Math.hypot(bx - ax, bz - az), rot = Math.atan2(bx - ax, bz - az), mx = (ax + bx) / 2, mz = (az + bz) / 2;
      deck.push(boxAt(4.6, 0.8, len + 4.6, mx, y, mz, rot));
      for (const s of [-1, 1]) { const g = new THREE.BoxGeometry(0.15, 0.25, len + 4.6); g.translate(s * 0.8, y + 0.9, 0); g.rotateY(rot); g.translate(mx, 0, mz); rails.push(g); const fence = new THREE.BoxGeometry(0.1, 0.6, len + 4.6); fence.translate(s * 2.25, y + 1.1, 0); fence.rotateY(rot); fence.translate(mx, 0, mz); rails.push(fence); }
    }
    merged(deck, keep(std(0x4a3f35, { metalness: 0.4, roughness: 0.7 })), true);
    merged(rails, metal);
    // a station on the south side of the loop
    merged([boxAt(30, 0.5, 4, 0, y + 0.3, -120 + 4.2), boxAt(30, 0.2, 5, 0, y + 4.6, -120 + 4.2)], keep(std(0x2b2f36)), true);
    merged([-14, -7, 0, 7, 14].map((x) => boxAt(0.25, 4.3, 0.25, x, y + 0.5, -120 + 6)), metal);
    const st = keep(signTexture([{ text: "HAVEN LOOP · DOWNTOWN", size: 84, color: "#ffffff" }], { w: 1024, h: 160, bg: "#1c3d7a" }));
    sign(st, 12, 1.9, 0, y + 3.4, -120 + 6.2, 0, true);
    // the train: four silver cars with lit windows
    const winTex = keep(canvasTex(256, 64, (g) => { g.fillStyle = "#c8ccd2"; g.fillRect(0, 0, 256, 64); for (let i = 0; i < 6; i++) { g.fillStyle = "#ffe8a8"; g.fillRect(10 + i * 41, 16, 30, 24); } g.fillStyle = "#1c3d7a"; g.fillRect(0, 48, 256, 6); }));
    const carMat = keep(new THREE.MeshStandardMaterial({ map: winTex, emissiveMap: winTex, emissive: 0x554433, emissiveIntensity: 0.6, metalness: 0.6, roughness: 0.35 }));
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(keep(new THREE.BoxGeometry(2.8, 3, 10)), [carMat, carMat, keep(std(0xb8bec6, { metalness: 0.7 })), dark, keep(std(0xb8bec6)), keep(std(0xb8bec6))]);
      body.position.y = 2.4; body.castShadow = true; g.add(body);
      parent.add(g); trainCars.push(g);
    }
    const lens = pts.map((p, i) => { const q = pts[(i + 1) % pts.length]; return Math.hypot(q[0] - p[0], q[1] - p[1]); });
    const total = lens.reduce((a, b) => a + b, 0);
    const at = (s: number) => {
      let d = ((s % total) + total) % total;
      for (let i = 0; i < pts.length; i++) {
        if (d <= lens[i]) { const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % pts.length], t = d / lens[i]; return { x: ax + (bx - ax) * t, z: az + (bz - az) * t, h: Math.atan2(bx - ax, bz - az) }; }
        d -= lens[i];
      }
      return { x: pts[0][0], z: pts[0][1], h: 0 };
    };
    updaters.push((t) => {
      // cruise, slowing to a stop at the station each lap
      const lap = 52, c = (t % lap) / lap, base = Math.floor(t / lap) * total;
      const s = base + (c < 0.85 ? (c / 0.85) * total : total);
      trainCars.forEach((g, i) => { const p = at(s - i * 10.6 + 380); g.position.set(p.x, y + 0.5, p.z); g.rotation.y = p.h; });
    });
  }

  return {
    update(t, dt) { for (const u of updaters) u(t, dt); },
    showRoom(id) {
      for (const [rid, g] of rooms) g.visible = rid === id;
      const room = INTERIORS.find((r) => r.id === id);
      if (room) { roomLight.position.set(room.x, 5, room.z); roomLight.color.set(room.kind === "arcade" ? 0xb197fc : 0xffe3b0); roomLight.intensity = 30; }
      else roomLight.intensity = 0;
    },
    rideSeat(id) {
      const obj = seats[id];
      const pos = new THREE.Vector3(); obj.getWorldPosition(pos);
      const ride = RIDES.find((r) => r.id === id)!;
      const rx = pos.x - ride.x, rz = pos.z - ride.z, rl = Math.hypot(rx, rz) || 1;
      // the wheel faces the city; the carousel rider looks where the horse is going; the drop rider looks out over the fair
      const look = id === "wheel" ? new THREE.Vector3(pos.x - 60, pos.y * 0.6, pos.z)
        : id === "carousel" ? (() => { const f = obj.getWorldDirection(new THREE.Vector3()); return new THREE.Vector3(pos.x + f.x * 8 - (rx / rl) * 1.5, pos.y + 1.2, pos.z + f.z * 8 - (rz / rl) * 1.5); })()
          : new THREE.Vector3(pos.x + (rx / rl) * 40, pos.y * 0.45, pos.z + (rz / rl) * 40);
      return { pos, look };
    },
    trainCars: () => trainCars,
  };
}
