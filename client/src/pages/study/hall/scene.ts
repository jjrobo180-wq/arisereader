// Study Squad: the 3D study hall. A warm, open room with eight round study
// tables, a chalkboard, a set library desk and a flashcard corner. Readers walk
// around as their own characters (the same avatars as Haven City), sit down at a
// table to play, and see everyone else in the hall. The page (StudySquad.tsx)
// owns all the data; this file only draws it and reports where the reader is.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { AvatarRig, nameTag } from "@/lib/worldAvatar";
import { ROOM } from "@shared/study/game";
import { LOUNGE, SPAWN, STATIONS, TABLE_SPOTS, clampToHall, seatSpot, type LoungePerson, type LoungeTable } from "@shared/study/lounge";

export type HallSpot = { kind: "table"; table: number } | { kind: "station"; id: keyof typeof STATIONS };
export type HallEvents = { onSpot(spot: HallSpot | null): void };
type Me = { id: number; name: string; characterId: string };
type Other = { rig: AvatarRig; target: THREE.Vector3; facing: number; characterId: string; name: string; seated: boolean; bubble: THREE.Sprite | null; bubbleUntil: number };

const WOOD = 0xb9763c, WOOD_DARK = 0x6b3f20, CHALK = 0xf4f1e6, PENCIL = 0xffc53d;
/** Tables can't be walked through; chairs sit just inside this ring. */
const TABLE_BLOCK = 3.35;
const TABLE_REACH = 5.1;
const AVATAR_HEIGHT = 2.3;

function canvasTexture(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void, repeat?: [number, number]) {
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  draw(cv.getContext("2d")!);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}

export class StudyHallScene {
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private rig: AvatarRig;
  private target = new THREE.Vector3();
  private keys = new Set<string>();
  private others = new Map<number, Other>();
  private bots = new Map<string, THREE.Group>();
  private signs: (THREE.Sprite | null)[] = [];
  private signText: string[] = [];
  private lamps: THREE.Mesh[] = [];
  private tables: LoungeTable[] = [];
  private seat: { table: number; seat: number } | null = null;
  private seatedNow = false;
  private solids: [number, number, number, number][] = [];
  private boardCtx: CanvasRenderingContext2D | null = null;
  private boardTex: THREE.CanvasTexture | null = null;
  private myBubble: THREE.Sprite | null = null;
  private myBubbleUntil = 0;
  private lastSpot = "";
  private disposed = false;
  private raf = 0;
  private clock = new THREE.Clock();
  private cleanup: (() => void)[] = [];

  constructor(private mount: HTMLElement, private me: Me, private events: HallEvents) {
    const scene = this.scene;
    scene.background = new THREE.Color(0x14241f);
    scene.fog = new THREE.Fog(0x14241f, 46, 90);
    this.camera = new THREE.PerspectiveCamera(52, 1, 0.1, 140);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    const renderer = this.renderer;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.innerHTML = ""; mount.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    this.controls = new OrbitControls(this.camera, renderer.domElement);
    const controls = this.controls;
    controls.enableDamping = true; controls.dampingFactor = 0.09; controls.enablePan = false;
    controls.minDistance = 5; controls.maxDistance = 24; controls.minPolarAngle = 0.3; controls.maxPolarAngle = 1.22;

    this.build();

    this.rig = new AvatarRig(me.characterId, AVATAR_HEIGHT, { noWeapons: true });
    this.rig.root.position.set(SPAWN.x, 0, SPAWN.z); this.rig.root.rotation.y = SPAWN.facing;
    const tag = nameTag(me.name, "#0f5c4a"); tag.position.y = AVATAR_HEIGHT + 0.75; tag.scale.multiplyScalar(0.62); this.rig.root.add(tag);
    scene.add(this.rig.root);
    this.target.copy(this.rig.root.position);
    this.followCamera();

    // input: tap the floor to walk there, drag to look around, WASD or arrows to walk
    const ray = new THREE.Raycaster(), pointer = new THREE.Vector2();
    let down: { x: number; y: number } | null = null;
    const pd = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY }; };
    const pu = (e: PointerEvent) => {
      const start = down; down = null;
      if (!start || Math.hypot(e.clientX - start.x, e.clientY - start.y) > 9 || this.seat) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(pointer, this.camera);
      for (const hit of ray.intersectObjects(scene.children, true)) {
        const table = this.tableOf(hit.object);
        if (table >= 0) { this.walkToTable(table); return; }
        if (hit.object.userData.ground) {
          const [x, z] = clampToHall(hit.point.x, hit.point.z);
          if (!this.blocked(x, z)) this.target.set(x, 0, z);
          return;
        }
      }
    };
    const typing = (e: KeyboardEvent) => { const el = e.target as HTMLElement | null; return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable); };
    const kd = (e: KeyboardEvent) => { if (!typing(e)) this.keys.add(e.key.toLowerCase()); };
    const ku = (e: KeyboardEvent) => { this.keys.delete(e.key.toLowerCase()); };
    const blur = () => this.keys.clear();
    const resize = () => {
      const w = mount.clientWidth, h = Math.max(1, mount.clientHeight);
      this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); renderer.setSize(w, h);
    };
    renderer.domElement.addEventListener("pointerdown", pd); renderer.domElement.addEventListener("pointerup", pu);
    window.addEventListener("keydown", kd); window.addEventListener("keyup", ku); window.addEventListener("blur", blur); window.addEventListener("resize", resize);
    this.cleanup.push(() => {
      renderer.domElement.removeEventListener("pointerdown", pd); renderer.domElement.removeEventListener("pointerup", pu);
      window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); window.removeEventListener("blur", blur); window.removeEventListener("resize", resize);
    });
    resize();
    this.loop();
  }

  // ─── Building the room ─────────────────────────────────────────────────────
  private mat(color: number, rough = 0.8, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) { return new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra }); }
  private box(size: [number, number, number], pos: [number, number, number], material: THREE.Material, parent: THREE.Object3D = this.scene, shadow = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.position.set(...pos); mesh.castShadow = shadow; mesh.receiveShadow = true; parent.add(mesh);
    return mesh;
  }
  private solid(cx: number, cz: number, w: number, d: number) { this.solids.push([cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2]); }

  private build() {
    const scene = this.scene, W = LOUNGE.halfW, D = LOUNGE.halfD;
    scene.add(new THREE.HemisphereLight(0xfff4dc, 0x3b2a1a, 1.7));
    const sun = new THREE.DirectionalLight(0xfff1d6, 1.9); sun.position.set(-14, 26, 16); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 20, bottom: -20 }); sun.shadow.camera.updateProjectionMatrix(); sun.shadow.bias = -0.0005;
    scene.add(sun);

    // floor: warm planks, with a round rug under every table
    const planks = canvasTexture(256, 256, (c) => {
      c.fillStyle = "#b9824a"; c.fillRect(0, 0, 256, 256);
      for (let y = 0; y < 256; y += 32) {
        c.fillStyle = `rgba(${90 + ((y * 7) % 40)},${52 + ((y * 3) % 20)},20,.22)`; c.fillRect(0, y, 256, 30);
        c.fillStyle = "rgba(0,0,0,.22)"; c.fillRect(0, y + 30, 256, 2); c.fillRect((y * 5) % 256, y, 2, 30); c.fillRect((y * 11 + 90) % 256, y, 2, 30);
      }
    }, [10, 7]);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W * 2, D * 2), new THREE.MeshStandardMaterial({ map: planks, roughness: 0.72 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; floor.userData.ground = true; scene.add(floor);
    const aisle = new THREE.Mesh(new THREE.PlaneGeometry(4.2, D * 2 - 3.2), this.mat(0x1f6b57, 1));
    aisle.rotation.x = -Math.PI / 2; aisle.position.set(0, 0.012, 1.2); aisle.receiveShadow = true; aisle.userData.ground = true; scene.add(aisle);

    // walls: tall at the back and sides, low at the front so the camera can always see in
    const wallMat = this.mat(0xe9dcc3, 0.95), trim = this.mat(WOOD_DARK, 0.7);
    const wall = (w: number, h: number, d: number, x: number, z: number) => { this.box([w, h, d], [x, h / 2, z], wallMat, scene, false); this.box([w + 0.04, 0.3, d + 0.06], [x, 0.15, z], trim, scene, false); };
    wall(W * 2 + 0.6, 6.2, 0.4, 0, -D - 0.2); wall(0.4, 6.2, D * 2, -W - 0.2, 0); wall(0.4, 6.2, D * 2, W + 0.2, 0);
    wall(W - 2.4, 1.1, 0.4, -(W + 2.4) / 2, D + 0.2); wall(W - 2.4, 1.1, 0.4, (W + 2.4) / 2, D + 0.2);
    // the door
    this.box([0.4, 3.4, 0.5], [-2.4, 1.7, D + 0.2], trim); this.box([0.4, 3.4, 0.5], [2.4, 1.7, D + 0.2], trim); this.box([5.2, 0.4, 0.5], [0, 3.5, D + 0.2], trim);
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.4), this.mat(0x8a4b16, 1)); mat.rotation.x = -Math.PI / 2; mat.position.set(0, 0.02, D - 1); scene.add(mat);
    const exit = nameTag("Leave the hall", "#7c2d12"); exit.position.set(0, 4.5, D + 0.2); exit.scale.multiplyScalar(0.8); scene.add(exit);

    // windows down both sides
    const sky = canvasTexture(256, 256, (c) => {
      const g = c.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, "#8ecbff"); g.addColorStop(1, "#e8f6ff"); c.fillStyle = g; c.fillRect(0, 0, 256, 256);
      c.fillStyle = "rgba(255,255,255,.92)"; for (const [x, y] of [[60, 70], [170, 50], [120, 120]]) { c.beginPath(); c.ellipse(x, y, 38, 14, 0, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = "#5fa85a"; c.fillRect(0, 205, 256, 51);
    });
    for (const side of [-1, 1]) for (const z of [-9, -3, 3, 9]) {
      const g = new THREE.Group(); g.position.set(side * (W - 0.02), 3.1, z); g.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2; scene.add(g);
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.6), new THREE.MeshBasicMaterial({ map: sky })); g.add(pane);
      this.box([3.7, 0.16, 0.14], [0, 1.36, 0.05], trim, g, false); this.box([3.7, 0.16, 0.14], [0, -1.36, 0.05], trim, g, false);
      this.box([0.16, 2.8, 0.14], [-1.78, 0, 0.05], trim, g, false); this.box([0.16, 2.8, 0.14], [1.78, 0, 0.05], trim, g, false); this.box([0.1, 2.6, 0.12], [0, 0, 0.05], trim, g, false);
    }

    // the chalkboard on the back wall shows this week's top readers
    const bw = 12, bh = 4.4;
    this.box([bw + 0.5, bh + 0.5, 0.2], [0, 3.3, -D + 0.12], trim, scene, false);
    const cv = document.createElement("canvas"); cv.width = 1024; cv.height = 376;
    this.boardCtx = cv.getContext("2d"); this.boardTex = new THREE.CanvasTexture(cv); this.boardTex.colorSpace = THREE.SRGBColorSpace; this.boardTex.anisotropy = 4;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), new THREE.MeshBasicMaterial({ map: this.boardTex })); board.position.set(0, 3.3, -D + 0.24); scene.add(board);
    this.box([bw + 0.5, 0.14, 0.4], [0, 0.98, -D + 0.3], trim, scene, false);
    this.setBoard([]);
    this.solid(0, -D + 0.3, bw + 1, 0.9);

    // bookshelves either side of the chalkboard
    const colors = [0x2563eb, 0xdc2626, 0x16a34a, 0xca8a04, 0x7c3aed, 0xdb2777, 0x0891b2, 0xf97316];
    const bookMats = colors.map((color) => this.mat(color, 0.7));
    for (const x of [-14.2, 14.2]) {
      const g = new THREE.Group(); g.position.set(x, 0, -D + 0.45); scene.add(g);
      const w = 9;
      this.box([w, 4.6, 0.6], [0, 2.3, 0], this.mat(WOOD_DARK, 0.85), g);
      for (let shelf = 0; shelf < 5; shelf++) {
        this.box([w - 0.3, 0.1, 0.66], [0, 0.45 + shelf * 0.85, 0.05], this.mat(0x8a5a2b, 0.8), g, false);
        for (let i = 0; i < 16; i++) {
          if ((i * 7 + shelf * 3) % 11 === 0) continue;
          const h = 0.48 + ((i * 5 + shelf) % 4) * 0.07;
          this.box([0.42, h, 0.36], [-w / 2 + 0.52 + i * 0.53, 0.52 + shelf * 0.85 + h / 2, 0.16], bookMats[(i * 3 + shelf) % bookMats.length], g, false);
        }
      }
      this.solid(x, -D + 0.45, w, 1.1);
    }

    // the study-set desk (front left) and the flashcard corner (front right)
    const desk = (x: number, z: number, label: string, color: string, stack: number) => {
      const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
      this.box([4.4, 1.05, 1.5], [0, 0.53, 0], this.mat(WOOD, 0.6), g); this.box([4.7, 0.12, 1.8], [0, 1.12, 0], this.mat(WOOD_DARK, 0.5), g);
      for (let i = 0; i < 5; i++) this.box([0.95 - i * 0.04, 0.16, 0.7], [-1.2 + (i % 2) * 0.06, 1.26 + i * 0.165, 0.05 * (i % 3)], this.mat(colors[(i + stack) % colors.length], 0.7), g);
      for (let i = 0; i < 3; i++) { const card = this.box([0.62, 0.84, 0.05], [0.7 + i * 0.5, 1.62, -0.1], this.mat(i === 1 ? PENCIL : CHALK, 0.6), g); card.rotation.x = -0.25; card.rotation.z = (i - 1) * 0.14; }
      const sign = nameTag(label, color); sign.position.set(0, 3.5, 0); g.add(sign);
      this.solid(x, z, 4.7, 1.8);
    };
    desk(STATIONS.library.x, STATIONS.library.z + 1.9, "Study sets", "#7c3aed", 0);
    desk(STATIONS.cards.x, STATIONS.cards.z + 1.9, "Flashcards", "#b45309", 3);

    // plants in the corners
    for (const [x, z] of [[-W + 1.2, -D + 2.4], [W - 1.2, -D + 2.4], [-5.2, D - 1], [5.2, D - 1]]) {
      const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
      this.box([0.9, 0.8, 0.9], [0, 0.4, 0], this.mat(0xc2410c, 0.9), g);
      for (let i = 0; i < 8; i++) { const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), this.mat(0x22a35a, 0.9)); leaf.scale.set(0.7, 1.7, 0.4); leaf.position.set(Math.cos(i) * 0.3, 1.25 + (i % 3) * 0.3, Math.sin(i) * 0.3); leaf.rotation.z = Math.cos(i) * 0.5; leaf.castShadow = true; g.add(leaf); }
      this.solid(x, z, 1, 1);
    }

    // eight round study tables, six chairs each, a lamp overhead and a sign that says what's happening
    const top = this.mat(WOOD, 0.45), leg = this.mat(WOOD_DARK, 0.6);
    const chairMats = [0xff6b5e, 0x7cc6fe, PENCIL, 0x7be495, 0xff8fa3, 0xb79cff].map((color) => this.mat(color, 0.7));
    TABLE_SPOTS.forEach((t, i) => {
      const g = new THREE.Group(); g.position.set(t.x, 0, t.z); g.userData.table = i; scene.add(g);
      const rug = new THREE.Mesh(new THREE.CircleGeometry(3.9, 48), this.mat(i % 2 ? 0x1f6b57 : 0x2a4f8f, 1)); rug.rotation.x = -Math.PI / 2; rug.position.y = 0.02; rug.receiveShadow = true; rug.userData.ground = true; g.add(rug);
      const slab = new THREE.Mesh(new THREE.CylinderGeometry(LOUNGE.tableRadius, LOUNGE.tableRadius, 0.14, 40), top); slab.position.y = 0.86; slab.castShadow = true; slab.receiveShadow = true; g.add(slab);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.8, 16), leg); post.position.y = 0.4; g.add(post);
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 0.1, 24), leg); foot.position.y = 0.05; g.add(foot);
      // a little desk lamp in the middle glows when the table is in use
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), new THREE.MeshStandardMaterial({ color: 0x334155, emissive: 0x000000, emissiveIntensity: 1.4, roughness: 0.4 }));
      lamp.position.y = 1.2; g.add(lamp); this.lamps.push(lamp);
      for (let s = 0; s < ROOM.seats; s++) {
        const spot = seatSpot(i, s);
        const chair = new THREE.Group(); chair.position.set(spot.x - t.x, 0, spot.z - t.z); chair.rotation.y = spot.facing; g.add(chair);
        const cm = chairMats[s % chairMats.length];
        this.box([0.86, 0.12, 0.86], [0, 0.5, 0], cm, chair); this.box([0.86, 0.9, 0.1], [0, 1.0, -0.42], cm, chair, false);
        this.box([0.5, 0.44, 0.5], [0, 0.22, 0], leg, chair, false);
      }
      const bulb = new THREE.PointLight(0xffe2b0, 5, 11, 1.7); bulb.position.set(0, 4.2, 0); g.add(bulb);
      const shade = new THREE.Mesh(new THREE.ConeGeometry(0.7, 0.6, 20, 1, true), new THREE.MeshStandardMaterial({ color: 0x14532d, emissive: 0xfde68a, emissiveIntensity: 0.25, side: THREE.DoubleSide })); shade.position.y = 4.6; g.add(shade);
      this.box([0.04, 1.6, 0.04], [0, 5.6, 0], leg, g, false);
      this.signs.push(null); this.signText.push("");
    });
    this.setTables([]);
  }

  private tableOf(object: THREE.Object3D | null) {
    for (let o = object; o; o = o.parent) if (typeof o.userData?.table === "number") return o.userData.table as number;
    return -1;
  }

  private blocked(x: number, z: number) {
    const [cx, cz] = clampToHall(x, z);
    if (cx !== x || cz !== z) return true;
    for (const t of TABLE_SPOTS) if (Math.hypot(x - t.x, z - t.z) < TABLE_BLOCK) return true;
    const r = 0.35;
    return this.solids.some(([x1, x2, z1, z2]) => x > x1 - r && x < x2 + r && z > z1 - r && z < z2 + r);
  }

  /** The table or station the reader is standing next to, if any. */
  private nearest(x: number, z: number): HallSpot | null {
    let best = Infinity, spot: HallSpot | null = null;
    for (let i = 0; i < TABLE_SPOTS.length; i++) {
      const d = Math.hypot(x - TABLE_SPOTS[i].x, z - TABLE_SPOTS[i].z);
      if (d < TABLE_REACH && d < best) { best = d; spot = { kind: "table", table: i }; }
    }
    if (spot) return spot;
    for (const id of Object.keys(STATIONS) as (keyof typeof STATIONS)[]) {
      const s = STATIONS[id], d = Math.hypot(x - s.x, z - s.z);
      if (d < s.r && d < best) { best = d; spot = { kind: "station", id }; }
    }
    return spot;
  }

  private walkToTable(table: number) {
    const t = TABLE_SPOTS[table], p = this.rig.root.position;
    const dx = p.x - t.x, dz = p.z - t.z, d = Math.hypot(dx, dz) || 1;
    const [x, z] = clampToHall(t.x + (dx / d) * (TABLE_BLOCK + 0.5), t.z + (dz / d) * (TABLE_BLOCK + 0.5));
    this.target.set(x, 0, z);
  }

  // ─── What the page tells the hall ──────────────────────────────────────────
  /** Redraws the chalkboard with this week's top readers. */
  setBoard(rows: { place: number; name: string; points: number }[]) {
    const c = this.boardCtx; if (!c || !this.boardTex) return;
    c.fillStyle = "#1f4a40"; c.fillRect(0, 0, 1024, 376);
    c.fillStyle = "rgba(255,255,255,.05)"; for (let i = 0; i < 26; i++) c.fillRect((i * 97) % 1024, (i * 53) % 376, 160, 3);
    c.fillStyle = "#ffc53d"; c.font = "700 54px Teko, Barlow, system-ui"; c.textBaseline = "middle"; c.textAlign = "left";
    c.fillText("This week's top studiers", 40, 52);
    c.font = "600 36px Barlow, system-ui";
    if (!rows.length) { c.fillStyle = "#f4f1e6"; c.fillText("Nobody yet. Finish a game to get your name up here.", 40, 190); }
    rows.slice(0, 5).forEach((r, i) => {
      const y = 122 + i * 50;
      c.fillStyle = i === 0 ? "#ffc53d" : "#f4f1e6"; c.textAlign = "left"; c.fillText(`${r.place}.  ${r.name}`, 40, y);
      c.textAlign = "right"; c.fillText(String(r.points), 984, y);
    });
    this.boardTex.needsUpdate = true;
  }

  /** What each table's sign says, and the study bots sitting at it. */
  setTables(tables: LoungeTable[]) {
    this.tables = tables;
    const wantBots = new Set<string>();
    TABLE_SPOTS.forEach((t, i) => {
      const room = tables[i] ?? null;
      const playing = !!room && room.phase !== "lobby" && room.phase !== "finished";
      const title = !room ? `Table ${i + 1}` : !room.publicTable ? "Private table" : `${room.hostName}'s table`;
      const sub = !room ? "Open. Sit down to start." : playing ? "Game in progress" : `${room.setTitle ? room.setTitle.slice(0, 26) : "Getting ready"} · ${room.seats.length}/${ROOM.seats}`;
      const color = !room ? "#334155" : playing ? "#b45309" : room.publicTable ? "#0f5c4a" : "#5b21b6";
      const text = `${title}|${sub}|${color}`;
      if (text !== this.signText[i]) {
        const old = this.signs[i];
        if (old) { this.scene.remove(old); old.material.map?.dispose(); old.material.dispose(); }
        const sign = nameTag(title, color, sub); sign.position.set(t.x, 3.55, t.z); sign.scale.multiplyScalar(0.92); this.scene.add(sign);
        this.signs[i] = sign; this.signText[i] = text;
      }
      const glow = this.lamps[i].material as THREE.MeshStandardMaterial;
      glow.emissive.setHex(!room ? 0x000000 : playing ? 0xff9a3d : PENCIL);
      for (const s of room?.seats ?? []) {
        if (!s.bot) continue;
        const key = `${i}:${s.seat}`; wantBots.add(key);
        if (!this.bots.has(key)) { const bot = this.makeBot(); const spot = seatSpot(i, s.seat); bot.position.set(spot.x, 0, spot.z); bot.rotation.y = spot.facing; this.scene.add(bot); this.bots.set(key, bot); }
      }
    });
    this.bots.forEach((bot, key) => { if (!wantBots.has(key)) { this.scene.remove(bot); this.bots.delete(key); } });
  }

  private makeBot() {
    const g = new THREE.Group();
    const body = this.mat(0xcbd5e1, 0.35, { metalness: 0.5 }), eye = new THREE.MeshStandardMaterial({ color: 0x67e8f9, emissive: 0x22d3ee, emissiveIntensity: 1.6 });
    this.box([0.8, 0.8, 0.6], [0, 1.05, 0], body, g); this.box([0.66, 0.56, 0.56], [0, 1.78, 0], body, g);
    this.box([0.14, 0.14, 0.04], [-0.16, 1.82, 0.29], eye, g, false); this.box([0.14, 0.14, 0.04], [0.16, 1.82, 0.29], eye, g, false);
    this.box([0.04, 0.3, 0.04], [0, 2.2, 0], body, g, false);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), eye); tip.position.y = 2.38; g.add(tip);
    return g;
  }

  /** Everyone else in the hall. Called after every sync with the server. */
  setPeople(people: LoungePerson[]) {
    const active = new Set<number>();
    for (const p of people) {
      if (p.userId === this.me.id) continue;
      active.add(p.userId);
      let o = this.others.get(p.userId);
      if (o && (o.characterId !== p.characterId || o.name !== p.name)) { this.removeOther(p.userId); o = undefined; }
      if (!o) {
        const rig = new AvatarRig(p.characterId, AVATAR_HEIGHT, { noWeapons: true });
        rig.root.position.set(p.x, 0, p.z); rig.root.rotation.y = p.facing;
        const tag = nameTag(p.name); tag.position.y = AVATAR_HEIGHT + 0.75; tag.scale.multiplyScalar(0.62); rig.root.add(tag);
        this.scene.add(rig.root);
        o = { rig, target: new THREE.Vector3(p.x, 0, p.z), facing: p.facing, characterId: p.characterId, name: p.name, seated: false, bubble: null, bubbleUntil: 0 };
        this.others.set(p.userId, o);
      }
      if (p.table >= 0 && p.seat >= 0) { const s = seatSpot(p.table, p.seat); o.target.set(s.x, 0, s.z); o.facing = s.facing; o.seated = true; }
      else { o.target.set(p.x, 0, p.z); o.facing = p.facing; o.seated = false; }
    }
    this.others.forEach((_, id) => { if (!active.has(id)) this.removeOther(id); });
  }

  private removeOther(id: number) {
    const o = this.others.get(id); if (!o) return;
    this.scene.remove(o.rig.root); o.rig.dispose(); this.others.delete(id);
  }

  /** Sits the reader at a table (or stands them back up with null). */
  setSeat(seat: { table: number; seat: number } | null) {
    const same = seat && this.seat && seat.table === this.seat.table && seat.seat === this.seat.seat;
    if (same || (!seat && !this.seat)) return;
    if (!seat) {
      const from = this.seat!; this.seat = null; this.seatedNow = false; this.rig.sit(false);
      const t = TABLE_SPOTS[from.table], s = seatSpot(from.table, from.seat);
      const [x, z] = clampToHall(t.x + (s.x - t.x) * 1.4, t.z + (s.z - t.z) * 1.4);
      this.rig.root.position.set(x, 0, z); this.target.set(x, 0, z);
      this.followCamera();
      return;
    }
    this.seat = seat; this.seatedNow = false;
    if (seat.table < 0) return;
    const s = seatSpot(seat.table, seat.seat);
    this.target.set(s.x, 0, s.z);
  }

  /** A speech bubble over a reader's head for a few seconds. */
  say(userId: number, phrase: string) {
    const until = performance.now() + ROOM.phraseMs;
    if (userId === this.me.id) {
      if (this.myBubble) this.rig.root.remove(this.myBubble);
      this.myBubble = this.bubble(phrase); this.rig.root.add(this.myBubble); this.myBubbleUntil = until;
      return;
    }
    const o = this.others.get(userId); if (!o) return;
    if (o.bubble) o.rig.root.remove(o.bubble);
    o.bubble = this.bubble(phrase); o.rig.root.add(o.bubble); o.bubbleUntil = until;
  }

  private bubble(phrase: string) {
    const cv = document.createElement("canvas"); cv.width = 512; cv.height = 160;
    const c = cv.getContext("2d")!;
    c.fillStyle = "#fffdf5"; c.beginPath(); (c as any).roundRect(10, 10, 492, 110, 40); c.fill();
    c.beginPath(); c.moveTo(226, 118); c.lineTo(256, 154); c.lineTo(286, 118); c.closePath(); c.fill();
    c.fillStyle = "#173b33"; c.font = "800 50px Barlow, system-ui"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(phrase.slice(0, 18), 256, 66);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    sprite.scale.set(3.4, 3.4 * 160 / 512, 1); sprite.position.y = AVATAR_HEIGHT + 1.75; sprite.renderOrder = 30;
    return sprite;
  }

  wave() { this.rig.gesture("wave"); }
  moveKey(key: "w" | "a" | "s" | "d", on: boolean) { if (on) this.keys.add(key); else this.keys.delete(key); }
  get position() { const p = this.rig.root.position; return { x: p.x, z: p.z, facing: this.rig.root.rotation.y }; }

  private followCamera() {
    const p = this.rig.root.position;
    this.camera.position.set(p.x, 8.2, p.z + 10.5);
    this.controls.target.set(p.x, 1.3, p.z);
    this.controls.update();
  }

  // ─── Every frame ───────────────────────────────────────────────────────────
  private fwd = new THREE.Vector3(); private right = new THREE.Vector3(); private up = new THREE.Vector3(0, 1, 0);

  private loop = () => {
    if (this.disposed) return;
    const dt = Math.min(0.05, this.clock.getDelta()), now = performance.now();
    const root = this.rig.root, before = root.position.clone();
    let speed = 0;

    if (this.seat && this.seat.table >= 0) {
      // walk straight to the chair (through the ring around the table), then sit facing the table
      const s = seatSpot(this.seat.table, this.seat.seat);
      const d = new THREE.Vector3(s.x - root.position.x, 0, s.z - root.position.z), dist = d.length();
      if (dist > 0.08) {
        const step = d.normalize().multiplyScalar(Math.min(dist, 6.5 * dt));
        root.position.add(step); root.rotation.y = Math.atan2(step.x, step.z); speed = step.length() / Math.max(dt, 1e-4);
      } else if (!this.seatedNow) {
        root.position.set(s.x, 0, s.z); root.rotation.y = s.facing; this.rig.sit(true); this.seatedNow = true;
      }
    } else {
      const k = this.keys;
      const fwdIn = (k.has("w") || k.has("arrowup") ? 1 : 0) - (k.has("s") || k.has("arrowdown") ? 1 : 0);
      const side = (k.has("d") || k.has("arrowright") ? 1 : 0) - (k.has("a") || k.has("arrowleft") ? 1 : 0);
      let step = new THREE.Vector3();
      if (side || fwdIn) {
        this.camera.getWorldDirection(this.fwd); this.fwd.y = 0;
        if (this.fwd.lengthSq() < 1e-4) this.fwd.set(0, 0, -1);
        this.fwd.normalize(); this.right.crossVectors(this.fwd, this.up).normalize();
        step = this.fwd.multiplyScalar(fwdIn).add(this.right.multiplyScalar(side)).normalize().multiplyScalar(5 * dt);
        this.target.copy(root.position).add(step);
      } else {
        const d = this.target.clone().sub(root.position); d.y = 0;
        if (d.length() > 0.1) step = d.normalize().multiplyScalar(Math.min(d.length(), 4.8 * dt));
      }
      if (step.lengthSq() > 0) {
        const nx = root.position.x + step.x, nz = root.position.z + step.z;
        if (this.blocked(root.position.x, root.position.z) || !this.blocked(nx, nz)) root.position.set(nx, 0, nz);
        else if (!this.blocked(nx, root.position.z)) root.position.x = nx;
        else if (!this.blocked(root.position.x, nz)) root.position.z = nz;
        else this.target.copy(root.position);
        let diff = Math.atan2(step.x, step.z) - root.rotation.y; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        root.rotation.y += diff * Math.min(1, dt * 12);
      }
    }
    const moved = root.position.clone().sub(before);
    if (!speed) speed = moved.length() / Math.max(dt, 1e-4);
    this.rig.update(dt, speed);
    this.camera.position.add(moved); this.controls.target.add(moved);

    this.others.forEach((o) => {
      const p = o.rig.root.position, mv = o.target.clone().sub(p); mv.y = 0;
      const far = mv.length();
      if (far > 12) p.copy(o.target); else p.lerp(o.target, Math.min(1, dt * 5));
      const sp = far * 5;
      if (far > 0.25) o.rig.root.rotation.y = THREE.MathUtils.lerp(o.rig.root.rotation.y, Math.atan2(mv.x, mv.z), Math.min(1, dt * 10));
      else o.rig.root.rotation.y = THREE.MathUtils.lerp(o.rig.root.rotation.y, o.facing, Math.min(1, dt * 8));
      const sitNow = o.seated && far < 0.25;
      if (sitNow !== o.rig.isSitting) o.rig.sit(sitNow);
      o.rig.update(dt, far > 0.25 ? Math.min(sp, 5) : 0);
      if (o.bubble && now > o.bubbleUntil) { o.rig.root.remove(o.bubble); o.bubble = null; }
    });
    if (this.myBubble && now > this.myBubbleUntil) { root.remove(this.myBubble); this.myBubble = null; }
    this.bots.forEach((bot, key) => { bot.rotation.z = Math.sin(now / 600 + key.length) * 0.03; });

    // what's close enough to use?
    const spot = this.seat ? null : this.nearest(root.position.x, root.position.z);
    const key = spot ? JSON.stringify(spot) : "";
    if (key !== this.lastSpot) { this.lastSpot = key; this.events.onSpot(spot); }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.loop);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.cleanup.forEach((fn) => fn());
    this.controls.dispose(); this.rig.dispose();
    this.others.forEach((o) => o.rig.dispose()); this.others.clear();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      mats.forEach((x: any) => { x.map?.dispose?.(); x.dispose?.(); });
    });
    this.renderer.dispose();
    this.mount.innerHTML = "";
  }
}
