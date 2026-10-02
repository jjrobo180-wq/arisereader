// Prism Paintball — the arena: sky, lighting, terrain, cover pieces and scenery.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { MAP, PB, type Collider, type BoxC, type CylC, type RampC } from "@shared/paintball";
import {
  grassDetailTexture, fieldTexture, woodTexture, vinylTexture, hayTexture, stoneTexture, canopyTexture, netTexture,
  beamTexture, scoreboardCanvas, fbm, FIELD_W, FIELD_D,
} from "./textures";

export type Quality = "low" | "medium" | "high";

const TEAM_VINYL = [0x14b8d9, 0xe63a92];
const NEUTRAL_VINYL: Record<string, number> = { inflBrick: 0xf6c23e, inflCan: 0xff8a3d, inflSnake: 0x8bd346, inflTemple: 0x8b5cf6 };

export const SUN_DIR = new THREE.Vector3(-0.42, 0.78, 0.46).normalize();

/** Adds a world-space detail texture multiply to a standard material. */
function addDetail(mat: THREE.MeshStandardMaterial, tex: THREE.Texture, scale: number, strength = 1.12) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.detailMap = { value: tex };
    shader.uniforms.detailScale = { value: scale };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vDetailUv;\nuniform float detailScale;")
      .replace("#include <uv_vertex>", "#include <uv_vertex>\nvDetailUv = (modelMatrix * vec4(position, 1.0)).xz * detailScale;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vDetailUv;\nuniform sampler2D detailMap;")
      .replace("#include <map_fragment>", `#include <map_fragment>\n diffuseColor.rgb *= texture2D(detailMap, vDetailUv).rgb * ${strength.toFixed(3)};`);
  };
  mat.customProgramCacheKey = () => "detail" + scale + strength;
}

function scaleUV(geo: THREE.BufferGeometry, su: number, sv: number) {
  const uv = geo.getAttribute("uv") as THREE.BufferAttribute | undefined;
  if (!uv) return geo;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  uv.needsUpdate = true;
  return geo;
}

/** Wedge geometry for a ramp in its local frame (rises toward +z). */
function rampGeometry(w: number, d: number, h: number) {
  const hw = w / 2, hd = d / 2;
  const A = [-hw, 0, -hd], B = [hw, 0, -hd], C = [hw, 0, hd], D = [-hw, 0, hd], E = [hw, h, hd], Fv = [-hw, h, hd];
  const pos: number[] = [], uv: number[] = [];
  const tri = (a: number[], b: number[], c: number[], ua: number[], ub: number[], uc: number[]) => { pos.push(...a, ...b, ...c); uv.push(...ua, ...ub, ...uc); };
  const slope = Math.hypot(d, h);
  // slope (top): A B E F
  tri(A, E, B, [0, 0], [w, slope], [w, 0]); tri(A, Fv, E, [0, 0], [0, slope], [w, slope]);
  // back face C D F E
  tri(C, Fv, D, [w, 0], [0, h], [0, 0]); tri(C, E, Fv, [w, 0], [w, h], [0, h]);
  // sides
  tri(B, E, C, [0, 0], [d, h], [d, 0]);
  tri(A, D, Fv, [0, 0], [d, 0], [d, h]);
  // bottom
  tri(A, B, C, [0, 0], [w, 0], [w, d]); tri(A, C, D, [0, 0], [w, d], [0, d]);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

function canGeometry(r: number, h: number) {
  const rr = Math.min(r * 0.45, 0.5);
  const pts: THREE.Vector2[] = [new THREE.Vector2(0, 0), new THREE.Vector2(r * 0.94, 0), new THREE.Vector2(r, 0.12)];
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * (Math.PI / 2);
    pts.push(new THREE.Vector2(r - rr + Math.cos(a) * rr, h - rr + Math.sin(a) * rr));
  }
  pts.push(new THREE.Vector2(0, h));
  return new THREE.LatheGeometry(pts, 28);
}

function barrelGeometry(r: number, h: number) {
  const pts: THREE.Vector2[] = [new THREE.Vector2(0, 0)];
  for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector2(r * (0.9 + Math.sin(t * Math.PI) * 0.1), t * h)); }
  pts.push(new THREE.Vector2(0, h));
  return new THREE.LatheGeometry(pts, 22);
}

function placeLocal(mesh: THREE.Object3D, c: BoxC | RampC, lx: number, ly: number, lz: number) {
  const co = Math.cos(c.rot), si = Math.sin(c.rot);
  mesh.position.set(c.x + lx * co + lz * si, ly, c.z - lx * si + lz * co);
  mesh.rotation.y = c.rot;
}

export class World {
  readonly root = new THREE.Group();
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  private updaters: ((dt: number, t: number) => void)[] = [];
  private disposables: { dispose(): void }[] = [];
  private flagUniform = { value: 0 };
  private board: { ctx: CanvasRenderingContext2D; tex: THREE.CanvasTexture; key: string };
  private crowd: { mesh: THREE.InstancedMesh; base: THREE.Matrix4[]; phase: Float32Array; cheer: number } | null = null;
  private prismLight: THREE.PointLight | null = null;
  readonly quality: Quality;

  constructor(private scene: THREE.Scene, private renderer: THREE.WebGLRenderer, quality: Quality) {
    this.quality = quality;
    const aniso = Math.min(quality === "high" ? 8 : 4, renderer.capabilities.getMaxAnisotropy());
    scene.add(this.root);

    // ---------------- Sky, fog, environment lighting ----------------
    const skyColorTop = new THREE.Color(0x2f7fe0), skyHorizon = new THREE.Color(0xcde9f7);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: skyColorTop }, horizon: { value: skyHorizon }, ground: { value: new THREE.Color(0x9cc0a8) }, sunDir: { value: SUN_DIR.clone() } },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 ground; uniform vec3 sunDir; varying vec3 vDir;
        void main(){ vec3 d = normalize(vDir); float h = d.y;
          vec3 col = h > 0.0 ? mix(horizon, top, pow(clamp(h, 0.0, 1.0), 0.55)) : mix(horizon, ground, clamp(-h * 6.0, 0.0, 1.0));
          float s = max(dot(d, sunDir), 0.0);
          col += vec3(1.0, 0.92, 0.75) * (pow(s, 900.0) * 6.0 + pow(s, 24.0) * 0.32 + pow(s, 4.0) * 0.08);
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), skyMat);
    sky.renderOrder = -10;
    sky.frustumCulled = false;
    this.root.add(sky);

    // environment map from the sky so glossy surfaces reflect it
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    const envSky = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), skyMat.clone());
    envSky.material.uniforms.sunDir.value = SUN_DIR.clone();
    envScene.add(envSky);
    const envTarget = pmrem.fromScene(envScene, 0.035);
    scene.environment = envTarget.texture;
    scene.environmentIntensity = 0.55;
    this.disposables.push(envTarget, pmrem, envSky.geometry, envSky.material as THREE.Material);

    scene.fog = new THREE.Fog(0xcde4ef, 95, 560);
    scene.background = skyHorizon.clone();

    this.hemi = new THREE.HemisphereLight(0xd8ecff, 0x5a7a40, 1.15);
    this.root.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff0d6, 3.1);
    this.sun.position.copy(SUN_DIR).multiplyScalar(90);
    this.sun.castShadow = quality !== "low";
    if (this.sun.castShadow) {
      const size = quality === "high" ? 4096 : 2048;
      this.sun.shadow.mapSize.set(size, size);
      const ext = quality === "high" ? 46 : 40;
      const cam = this.sun.shadow.camera;
      cam.left = -ext; cam.right = ext; cam.top = ext; cam.bottom = -ext; cam.near = 10; cam.far = 220;
      this.sun.shadow.bias = -0.00025;
      this.sun.shadow.normalBias = 0.035;
      this.sun.shadow.radius = 3;
    }
    this.root.add(this.sun, this.sun.target);

    // ---------------- Ground ----------------
    const detail = grassDetailTexture(aniso);
    detail.wrapS = detail.wrapT = THREE.RepeatWrapping;
    this.disposables.push(detail);
    const groundGeo = new THREE.PlaneGeometry(1100, 1100, 180, 180);
    groundGeo.rotateX(-Math.PI / 2);
    const gp = groundGeo.getAttribute("position") as THREE.BufferAttribute;
    const colors = new Float32Array(gp.count * 3);
    const cA = new THREE.Color(0x4f8f3f), cB = new THREE.Color(0x77ab4c), cC = new THREE.Color(0x8b8c5a), tmp = new THREE.Color();
    for (let i = 0; i < gp.count; i++) {
      const x = gp.getX(i), z = gp.getZ(i);
      const ox = Math.max(0, Math.abs(x) - 58), oz = Math.max(0, Math.abs(z) - 50);
      const out = Math.hypot(ox, oz);
      const n = fbm((x + 2000) / 90, (z + 2000) / 90, 1000, 4, 21);
      const ramp = THREE.MathUtils.smoothstep(out, 0, 70);
      let h = ramp * (n * 26 + 3) + THREE.MathUtils.smoothstep(Math.hypot(x, z), 330, 520) * (40 + n * 120);
      if (Math.abs(x) < PB.ARENA_X + 6 && Math.abs(z) < PB.ARENA_Z + 6) h = -0.03;
      gp.setY(i, h);
      const m = fbm(x / 30 + 50, z / 30 + 50, 1000, 3, 4);
      tmp.copy(cA).lerp(cB, m).lerp(cC, THREE.MathUtils.clamp((h - 50) / 90, 0, 0.7));
      colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
    }
    groundGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    groundGeo.computeVertexNormals();
    const groundMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0, map: detail });
    scaleUV(groundGeo, 1100 / 7, 1100 / 7);
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.receiveShadow = true;
    this.root.add(ground);
    this.disposables.push(groundGeo, groundMat);

    const turfTex = fieldTexture(aniso, quality !== "low");
    const turfMat = new THREE.MeshStandardMaterial({ map: turfTex, roughness: 0.93, metalness: 0 });
    addDetail(turfMat, detail, 1 / 3.5, 1.16);
    const turf = new THREE.Mesh(new THREE.PlaneGeometry(FIELD_W, FIELD_D), turfMat);
    turf.rotation.x = -Math.PI / 2;
    turf.receiveShadow = true;
    this.root.add(turf);
    this.disposables.push(turfTex, turfMat, turf.geometry);

    // ---------------- Cover pieces ----------------
    this.buildColliders(aniso);
    this.buildPerimeter(aniso);
    this.buildPrism();
    this.buildScenery(aniso);
    this.board = this.buildScoreboard();
    if (quality === "high") this.buildGrass();
    this.buildClouds();
  }

  // -------------------------------------------------------------------------

  private stat(mesh: THREE.Mesh, cast = true) {
    mesh.castShadow = cast && this.quality !== "low";
    mesh.receiveShadow = true;
    mesh.userData.static = true;
    this.root.add(mesh);
    return mesh;
  }

  private buildColliders(aniso: number) {
    const q = this.quality;
    const vinylTex = vinylTexture(aniso);
    vinylTex.wrapS = vinylTex.wrapT = THREE.RepeatWrapping;
    const plank = woodTexture(aniso, "plank"); plank.wrapS = plank.wrapT = THREE.RepeatWrapping;
    const crateTex = woodTexture(aniso, "crate");
    const hay = hayTexture(aniso); hay.wrapS = hay.wrapT = THREE.RepeatWrapping;
    this.disposables.push(vinylTex, plank, crateTex, hay);

    const vinylCache = new Map<number, THREE.Material>();
    const vinyl = (color: number) => {
      let m = vinylCache.get(color);
      if (!m) {
        m = q === "low"
          ? new THREE.MeshStandardMaterial({ color, map: vinylTex, roughness: 0.38, metalness: 0 })
          : new THREE.MeshPhysicalMaterial({ color, map: vinylTex, roughness: 0.36, metalness: 0, clearcoat: 0.7, clearcoatRoughness: 0.22, sheen: 0.3, sheenColor: new THREE.Color(0xffffff) });
        vinylCache.set(color, m);
        this.disposables.push(m);
      }
      return m;
    };
    const woodMat = new THREE.MeshStandardMaterial({ map: plank, roughness: 0.82, metalness: 0 });
    const darkWood = new THREE.MeshStandardMaterial({ map: plank, color: 0x8a6a4a, roughness: 0.85 });
    const crateMat = new THREE.MeshStandardMaterial({ map: crateTex, roughness: 0.8 });
    const hayMat = new THREE.MeshStandardMaterial({ map: hay, roughness: 0.95 });
    const rubber = new THREE.MeshStandardMaterial({ color: 0x1c1d22, roughness: 0.78, metalness: 0.05 });
    const metal = new THREE.MeshStandardMaterial({ color: 0x9aa4ae, roughness: 0.35, metalness: 0.85 });
    const teamCanopy = [canopyTexture(0), canopyTexture(1), canopyTexture(2)];
    this.disposables.push(woodMat, darkWood, crateMat, hayMat, rubber, metal, ...teamCanopy);

    for (const c of MAP.colliders) {
      if (c.vis === "net" || c.vis === "prism" || c.vis === "plinth") continue;
      const teamColor = c.team === 2 ? NEUTRAL_VINYL[c.vis] ?? 0xf6c23e : TEAM_VINYL[c.team];
      if (c.kind === "box") {
        const b = c as BoxC;
        if (b.vis === "inflBrick" || b.vis === "inflTemple") {
          const r = Math.min(b.w, b.d, b.h) * 0.32;
          const geo = new RoundedBoxGeometry(b.w, b.h, b.d, 5, r);
          scaleUV(geo, 1, 1);
          const m = this.stat(new THREE.Mesh(geo, vinyl(teamColor)));
          placeLocal(m, b, 0, b.y + b.h / 2, 0);
          this.addAnchor(b);
        } else if (b.vis === "inflSnake") {
          const segs = Math.max(2, Math.round(b.w / 1.55));
          const parts: THREE.BufferGeometry[] = [];
          for (let i = 0; i < segs; i++) {
            const len = b.w / segs + 0.12;
            const g = new RoundedBoxGeometry(len, b.h, b.d, 4, Math.min(b.h, b.d) * 0.45);
            g.translate(-b.w / 2 + (i + 0.5) * (b.w / segs), 0, 0);
            parts.push(g);
          }
          const geo = mergeGeometries(parts) || parts[0];
          const m = this.stat(new THREE.Mesh(geo, vinyl(teamColor)));
          placeLocal(m, b, 0, b.y + b.h / 2, 0);
        } else if (b.vis === "crate") {
          const geo = new THREE.BoxGeometry(b.w, b.h, b.d);
          const m = this.stat(new THREE.Mesh(geo, crateMat));
          placeLocal(m, b, 0, b.y + b.h / 2, 0);
        } else if (b.vis === "deck") {
          const geo = scaleUV(new THREE.BoxGeometry(b.w, b.h, b.d), b.w / 2.4, b.d / 2.4);
          const m = this.stat(new THREE.Mesh(geo, woodMat));
          placeLocal(m, b, 0, b.y + b.h / 2, 0);
          // joists under the deck
          for (let i = -1; i <= 1; i++) {
            const j = this.stat(new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.98, 0.22, 0.16), darkWood));
            placeLocal(j, b, 0, b.y - 0.11, (i * b.d) / 2.6);
          }
        } else if (b.vis === "rail") {
          const geo = scaleUV(new THREE.BoxGeometry(b.w, b.h, b.d), Math.max(b.w, b.d) / 2.4, b.h / 2.4);
          const m = this.stat(new THREE.Mesh(geo, woodMat));
          placeLocal(m, b, 0, b.y + b.h / 2, 0);
          const cap = this.stat(new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.12, 0.08, b.d + 0.12), darkWood));
          placeLocal(cap, b, 0, b.y + b.h + 0.04, 0);
        } else if (b.vis === "roof") {
          const geo = new THREE.BoxGeometry(b.w, b.h, b.d);
          const mat = new THREE.MeshStandardMaterial({ map: teamCanopy[b.team], roughness: 0.7, side: THREE.DoubleSide });
          this.disposables.push(mat);
          const m = this.stat(new THREE.Mesh(geo, mat));
          placeLocal(m, b, 0, b.y + b.h / 2, 0);
          // scalloped valance
          for (const side of [-1, 1]) {
            const v = this.stat(new THREE.Mesh(new THREE.BoxGeometry(b.w, 0.45, 0.04), mat), false);
            placeLocal(v, b, 0, b.y - 0.2, side * (b.d / 2));
          }
        } else if (b.vis === "hay") {
          const geo = scaleUV(new RoundedBoxGeometry(b.w, b.h, b.d, 2, 0.1), b.w / 1.4, 1);
          const m = this.stat(new THREE.Mesh(geo, hayMat));
          placeLocal(m, b, 0, b.y + b.h / 2, 0);
        }
      } else if (c.kind === "cyl") {
        const y = c as CylC;
        if (y.vis === "inflCan") {
          const m = this.stat(new THREE.Mesh(scaleUV(canGeometry(y.r, y.h), 2, 1), vinyl(teamColor)));
          m.position.set(y.x, y.y, y.z);
        } else if (y.vis === "post") {
          const m = this.stat(new THREE.Mesh(new THREE.CylinderGeometry(y.r, y.r * 1.08, y.h, 10), y.y > 0.5 ? metal : darkWood));
          m.position.set(y.x, y.y + y.h / 2, y.z);
        } else if (y.vis === "tires") {
          const n = Math.max(1, Math.round(y.h / 0.44));
          const parts: THREE.BufferGeometry[] = [];
          for (let i = 0; i < n; i++) {
            const g = new THREE.TorusGeometry(y.r - 0.18, 0.2, 10, 24);
            g.rotateX(Math.PI / 2);
            g.translate(0, 0.2 + i * (y.h - 0.2) / Math.max(1, n - 0.6), 0);
            parts.push(g);
          }
          const m = this.stat(new THREE.Mesh(mergeGeometries(parts) || parts[0], rubber));
          m.position.set(y.x, y.y, y.z);
          const band = this.stat(new THREE.Mesh(new THREE.TorusGeometry(y.r - 0.02, 0.035, 6, 24), vinyl(0xf6c23e)), false);
          band.rotation.x = Math.PI / 2; band.position.set(y.x, y.y + y.h * 0.62, y.z);
        } else if (y.vis === "barrel") {
          const m = this.stat(new THREE.Mesh(barrelGeometry(y.r, y.h), vinyl(0x2563eb)));
          m.position.set(y.x, y.y, y.z);
          for (const t of [0.22, 0.78]) {
            const rib = this.stat(new THREE.Mesh(new THREE.TorusGeometry(y.r * 0.99, 0.025, 6, 22), metal), false);
            rib.rotation.x = Math.PI / 2; rib.position.set(y.x, y.y + y.h * t, y.z);
          }
        }
      } else {
        const r = c as RampC;
        const geo = scaleUV(rampGeometry(r.w, r.d, r.h), 1 / 2.4, 1 / 2.4);
        const m = this.stat(new THREE.Mesh(geo, woodMat));
        placeLocal(m, r, 0, r.y, 0);
        // cleats across the slope
        const slopeLen = Math.hypot(r.d, r.h), ang = Math.atan2(r.h, r.d);
        for (let k = 1; k < 8; k++) {
          const t = k / 8;
          const cleat = this.stat(new THREE.Mesh(new THREE.BoxGeometry(r.w * 0.94, 0.05, 0.08), darkWood), false);
          placeLocal(cleat, r, 0, r.y + r.h * t + 0.03, -r.d / 2 + r.d * t);
          cleat.rotation.set(0, r.rot, 0);
          cleat.rotateX(-ang);
        }
        void slopeLen;
      }
    }
  }

  /** Little stake + strap for inflatables. */
  private addAnchor(b: BoxC) {
    if (this.quality === "low") return;
    const strapMat = this.strapMat || (this.strapMat = new THREE.MeshStandardMaterial({ color: 0x222831, roughness: 0.7 }));
    for (const side of [-1, 1]) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 0.05), strapMat);
      placeLocal(s, b, side * (b.w / 2 + 0.12), 0.15, 0);
      s.userData.static = true;
      this.root.add(s);
    }
  }
  private strapMat: THREE.MeshStandardMaterial | null = null;

  private buildPerimeter(aniso: number) {
    const { ARENA_X: AX, ARENA_Z: AZ, NET_HEIGHT: NH } = PB;
    const net = netTexture(); net.wrapS = net.wrapT = THREE.RepeatWrapping; net.anisotropy = aniso;
    const netMat = new THREE.MeshStandardMaterial({ map: net, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.9, depthWrite: true });
    const pole = new THREE.MeshStandardMaterial({ color: 0x2f3640, roughness: 0.4, metalness: 0.7 });
    const board = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.6, metalness: 0.1 });
    const stripe = [new THREE.MeshStandardMaterial({ color: 0x22d3ee, roughness: 0.5, emissive: 0x0b4f5c, emissiveIntensity: 0.3 }), new THREE.MeshStandardMaterial({ color: 0xf0479a, roughness: 0.5, emissive: 0x5c0b33, emissiveIntensity: 0.3 })];
    this.disposables.push(net, netMat, pole, board, ...stripe);
    const sides: [number, number, number, number][] = [[-AX, 0, AZ * 2, Math.PI / 2], [AX, 0, AZ * 2, Math.PI / 2], [0, -AZ, AX * 2, 0], [0, AZ, AX * 2, 0]];
    for (const [x, z, len, rot] of sides) {
      const plane = new THREE.Mesh(scaleUV(new THREE.PlaneGeometry(len, NH), len / 1.1, NH / 1.1), netMat);
      plane.position.set(x, NH / 2, z); plane.rotation.y = rot;
      this.root.add(plane);
      const kb = this.stat(new THREE.Mesh(new THREE.BoxGeometry(len, 0.55, 0.12), board));
      kb.position.set(x, 0.275, z); kb.rotation.y = rot;
      const st = this.stat(new THREE.Mesh(new THREE.BoxGeometry(len, 0.1, 0.13), stripe[x < 0 ? 0 : x > 0 ? 1 : z < 0 ? 0 : 1]), false);
      st.position.set(x, 0.42, z); st.rotation.y = rot;
      const n = Math.round(len / 7);
      for (let i = 0; i <= n; i++) {
        const t = -len / 2 + (len * i) / n;
        const p = this.stat(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, NH + 0.4, 8), pole));
        if (rot === 0) p.position.set(x + t, (NH + 0.4) / 2, z); else p.position.set(x, (NH + 0.4) / 2, z + t);
      }
      const cable = this.stat(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, len, 6), pole), false);
      cable.rotation.z = Math.PI / 2; cable.rotation.y = rot;
      cable.position.set(x, NH + 0.1, z);
    }
  }

  private buildPrism() {
    const q = this.quality;
    const stone = stoneTexture(4); stone.wrapS = stone.wrapT = THREE.RepeatWrapping;
    const stoneMat = new THREE.MeshStandardMaterial({ map: stone, roughness: 0.75, metalness: 0.02 });
    this.disposables.push(stone, stoneMat);
    const plinthC = MAP.colliders.find((c) => c.vis === "plinth") as CylC;
    const prismC = MAP.colliders.find((c) => c.vis === "prism") as CylC;
    const plinthPts = [new THREE.Vector2(0, 0), new THREE.Vector2(plinthC.r, 0), new THREE.Vector2(plinthC.r, plinthC.h - 0.06), new THREE.Vector2(plinthC.r - 0.08, plinthC.h), new THREE.Vector2(0, plinthC.h)];
    const plinth = this.stat(new THREE.Mesh(scaleUV(new THREE.LatheGeometry(plinthPts, 48), 6, 1), stoneMat));
    plinth.position.set(0, 0, 0);
    // glowing rainbow inlay
    const ringGeo = new THREE.RingGeometry(plinthC.r - 0.55, plinthC.r - 0.35, 96, 1);
    const rc = new Float32Array(ringGeo.getAttribute("position").count * 3);
    const pos = ringGeo.getAttribute("position");
    const col = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const a = Math.atan2(pos.getY(i), pos.getX(i));
      col.setHSL(((a / (Math.PI * 2)) + 1) % 1, 0.95, 0.6);
      rc[i * 3] = col.r; rc[i * 3 + 1] = col.g; rc[i * 3 + 2] = col.b;
    }
    ringGeo.setAttribute("color", new THREE.BufferAttribute(rc, 3));
    const ringMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2; ring.position.y = plinthC.h + 0.006;
    this.root.add(ring);
    this.disposables.push(ringGeo, ringMat);

    // stylised crystal: rainbow light bands that shift with the view, bright fresnel edges
    const crystalUniforms = { uTime: { value: 0 } };
    const crystalMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: crystalUniforms,
      vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vW;
        void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform float uTime; varying vec3 vN; varying vec3 vV; varying vec3 vW;
        vec3 hue(float h){ return clamp(abs(mod(h*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0,0.0,1.0); }
        void main(){
          float ndv = abs(dot(normalize(vN), normalize(vV)));
          float fres = pow(1.0 - ndv, 2.2);
          float bands = vW.y * 0.32 + dot(vV, vec3(0.6,0.2,0.4)) * 1.4 + uTime * 0.06;
          vec3 rainbow = hue(fract(bands));
          vec3 col = mix(vec3(0.82,0.94,1.0), rainbow, 0.55) * (0.55 + 0.6 * fres) + vec3(1.0) * fres * 0.9;
          float sparkle = pow(max(0.0, sin(vW.y * 9.0 + uTime * 2.0 + vW.x * 4.0)), 24.0) * 0.6;
          col += sparkle;
          float a = clamp(0.38 + fres * 0.55 + sparkle, 0.0, 0.95);
          gl_FragColor = vec4(col, a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.updaters.push((_dt, t) => { crystalUniforms.uTime.value = t; });
    this.disposables.push(crystalMat);
    const prism = new THREE.Mesh(new THREE.CylinderGeometry(prismC.r * 1.05, prismC.r * 1.05, prismC.h, 3, 1), crystalMat);
    prism.position.set(0, prismC.y + prismC.h / 2, 0);
    prism.castShadow = false;
    prism.renderOrder = 2;
    this.root.add(prism);
    // crisp bright edges along the prism
    const edgeMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, toneMapped: false });
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(prism.geometry), edgeMat);
    edges.position.copy(prism.position);
    this.root.add(edges);
    this.disposables.push(edgeMat, edges.geometry);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xfff7d6, transparent: true, opacity: 0.55, toneMapped: false });
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, prismC.h * 0.9, 12), coreMat);
    core.position.copy(prism.position);
    this.root.add(core);
    this.disposables.push(coreMat, core.geometry, prism.geometry);

    // floating crown crystals
    const crown = new THREE.Group();
    crown.position.set(0, prismC.y + prismC.h + 1.3, 0);
    const gemColors = [0x22d3ee, 0xf0479a, 0xfacc15];
    gemColors.forEach((c, i) => {
      const m = new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.1, metalness: 0.2, emissive: c, emissiveIntensity: 0.55, clearcoat: 1, iridescence: 0.6 });
      this.disposables.push(m);
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), m);
      const a = (i / 3) * Math.PI * 2;
      gem.position.set(Math.cos(a) * 1.4, 0, Math.sin(a) * 1.4);
      gem.scale.set(0.8, 1.4, 0.8);
      gem.castShadow = q !== "low";
      crown.add(gem);
    });
    this.root.add(crown);

    // rainbow light beams
    const beamTex = beamTexture();
    const beams = new THREE.Group();
    beams.position.set(0, prismC.y + prismC.h, 0);
    const hues = [0, 0.08, 0.16, 0.33, 0.5, 0.72];
    hues.forEach((h, i) => {
      const m = new THREE.MeshBasicMaterial({ map: beamTex, color: new THREE.Color().setHSL(h, 1, 0.6), transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false });
      this.disposables.push(m);
      const beam = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 60), m);
      beam.geometry.translate(0, 30, 0);
      const a = (i / hues.length) * Math.PI * 2;
      beam.rotation.set(0, a, 0);
      beam.rotateX(0.32);
      beams.add(beam);
    });
    this.root.add(beams);
    this.disposables.push(beamTex);

    if (q !== "low") {
      this.prismLight = new THREE.PointLight(0xffffff, 18, 16, 1.6);
      this.prismLight.position.set(0, 3, 0);
      this.root.add(this.prismLight);
    }
    this.updaters.push((dt, t) => {
      crown.rotation.y += dt * 0.6;
      crown.position.y = prismC.y + prismC.h + 1.3 + Math.sin(t * 1.3) * 0.18;
      crown.children.forEach((g, i) => { g.rotation.y += dt * (1.2 + i * 0.3); });
      beams.rotation.y = t * 0.12;
      if (this.prismLight) this.prismLight.color.setHSL((t * 0.05) % 1, 0.9, 0.62);
    });
  }

  private buildScenery(aniso: number) {
    const q = this.quality;
    const { ARENA_X: AX, ARENA_Z: AZ } = PB;

    // ---- bleachers with a cheering crowd ----
    const metal = new THREE.MeshStandardMaterial({ color: 0xc5ccd6, roughness: 0.32, metalness: 0.85 });
    const frame = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.6 });
    this.disposables.push(metal, frame);
    const fanGeoParts: THREE.BufferGeometry[] = [];
    const body = new THREE.CapsuleGeometry(0.22, 0.42, 4, 8); body.translate(0, 0.45, 0); fanGeoParts.push(body);
    const head = new THREE.SphereGeometry(0.17, 10, 8); head.translate(0, 0.98, 0); fanGeoParts.push(head);
    const armL = new THREE.CapsuleGeometry(0.07, 0.36, 3, 6); armL.translate(-0.3, 0.95, 0); fanGeoParts.push(armL);
    const armR = armL.clone(); armR.translate(0.6, 0, 0); fanGeoParts.push(armR);
    const fanGeo = mergeGeometries(fanGeoParts.map((g) => { g.deleteAttribute("uv"); return g; })) as THREE.BufferGeometry;
    const fanMat = new THREE.MeshStandardMaterial({ roughness: 0.75 });
    this.disposables.push(fanGeo, fanMat);
    const rows = 5, perRow = q === "low" ? 10 : 18;
    const fans = new THREE.InstancedMesh(fanGeo, fanMat, rows * perRow * 2);
    const base: THREE.Matrix4[] = [];
    const phase = new Float32Array(rows * perRow * 2);
    const fanColors = [0x22d3ee, 0xf0479a, 0xfacc15, 0xffffff, 0x4ade80, 0xa78bfa, 0xfb923c];
    let fi = 0;
    for (const side of [-1, 1]) {
      const z0 = side * (AZ + 6);
      for (let r = 0; r < rows; r++) {
        const seat = this.stat(new THREE.Mesh(new THREE.BoxGeometry(40, 0.12, 0.7), metal));
        seat.position.set(0, 0.55 + r * 0.62, z0 + side * r * 1.0);
        const riser = this.stat(new THREE.Mesh(new THREE.BoxGeometry(40, 0.62, 0.05), frame), false);
        riser.position.set(0, 0.28 + r * 0.62, z0 + side * (r * 1.0 - 0.38));
        for (let k = 0; k < perRow; k++) {
          const m = new THREE.Matrix4();
          const x = -19 + (k + (r % 2) * 0.5) * (38 / perRow) + (Math.random() - 0.5) * 0.5;
          m.makeRotationY(side > 0 ? Math.PI : 0);
          m.setPosition(x, 0.62 + r * 0.62, z0 + side * (r * 1.0 + 0.05));
          base.push(m);
          phase[fi] = Math.random() * Math.PI * 2;
          const team = x < 0 ? 0 : 1;
          fans.setColorAt(fi, new THREE.Color(Math.random() < 0.6 ? (team === 0 ? 0x22d3ee : 0xf0479a) : fanColors[Math.floor(Math.random() * fanColors.length)]));
          fans.setMatrixAt(fi, m);
          fi++;
        }
      }
      // frame legs
      for (let k = -4; k <= 4; k++) {
        const leg = this.stat(new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.6, 0.12), frame));
        leg.position.set(k * 5, 1.8, z0 + side * 4.2);
      }
    }
    fans.count = fi;
    fans.castShadow = q === "high";
    this.root.add(fans);
    this.crowd = { mesh: fans, base, phase, cheer: 0 };

    // ---- stadium light towers ----
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xfffbe6, toneMapped: false });
    this.disposables.push(lampMat);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const pole = this.stat(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.35, 22, 10), frame));
      pole.position.set(sx * (AX + 9), 11, sz * (AZ + 12));
      const panel = this.stat(new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.4, 0.35), frame));
      panel.position.set(sx * (AX + 9), 22.4, sz * (AZ + 12));
      panel.lookAt(0, 0, 0);
      for (let i = 0; i < 6; i++) {
        const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.42, 16), lampMat);
        lamp.position.set(-1.4 + (i % 3) * 1.4, i < 3 ? 0.55 : -0.55, 0.19);
        panel.add(lamp);
      }
    }

    // ---- team flags ----
    const flagUniform = this.flagUniform;
    for (const team of [0, 1]) {
      const fmat = new THREE.MeshStandardMaterial({ color: team === 0 ? 0x22d3ee : 0xf0479a, side: THREE.DoubleSide, roughness: 0.65 });
      fmat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = flagUniform;
        shader.vertexShader = shader.vertexShader
          .replace("#include <common>", "#include <common>\nuniform float uTime;")
          .replace("#include <begin_vertex>", "#include <begin_vertex>\nfloat k = (position.x + 1.1) / 2.2;\ntransformed.z += sin(uTime * 4.0 + position.x * 2.6) * 0.22 * k + sin(uTime * 2.3 + position.y * 3.0) * 0.06 * k;");
      };
      this.disposables.push(fmat);
      for (const sz of [-7.5, 7.5]) {
        const x = (team === 0 ? -1 : 1) * 38.5, z = team === 0 ? sz : -sz;
        const pole = this.stat(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 8, 8), metal));
        pole.position.set(x, 4, z);
        const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.3, 16, 6), fmat);
        flag.geometry.translate(1.1, 0, 0);
        flag.position.set(x, 7.2, z);
        flag.rotation.y = Math.PI / 2;
        flag.castShadow = q !== "low";
        this.root.add(flag);
      }
    }

    // ---- trees ----
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.36, 3.2, 7); trunkGeo.translate(0, 1.6, 0);
    const leafParts: THREE.BufferGeometry[] = [];
    const blobs: [number, number, number, number][] = [[0, 4.2, 0, 1.9], [0.9, 3.6, 0.4, 1.3], [-0.8, 3.8, -0.3, 1.4], [0.2, 5.3, -0.2, 1.2], [-0.3, 3.4, 0.9, 1.1]];
    for (const [x, y, z, r] of blobs) {
      const g = new THREE.IcosahedronGeometry(r, 2);
      const p = g.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i);
        const s = 1 + (fbm(vx * 1.7 + 10, vy * 1.7 + vz * 1.3, 100, 2, 3) - 0.5) * 0.35;
        p.setXYZ(i, vx * s, vy * s * 0.9, vz * s);
      }
      g.translate(x, y, z);
      leafParts.push(g);
    }
    const leafGeo = mergeGeometries(leafParts) as THREE.BufferGeometry;
    leafGeo.computeVertexNormals();
    const pineParts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 4; i++) { const g = new THREE.ConeGeometry(2.1 - i * 0.42, 2.4, 9); g.translate(0, 2.6 + i * 1.25, 0); pineParts.push(g); }
    const pineGeo = mergeGeometries(pineParts) as THREE.BufferGeometry;
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.95 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x4f9a3a, roughness: 0.85 });
    const pineMat = new THREE.MeshStandardMaterial({ color: 0x2f6b3a, roughness: 0.9 });
    this.disposables.push(trunkGeo, leafGeo, pineGeo, trunkMat, leafMat, pineMat);
    const count = q === "high" ? 180 : q === "medium" ? 120 : 70;
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
    const leaves = new THREE.InstancedMesh(leafGeo, leafMat, count);
    const pines = new THREE.InstancedMesh(pineGeo, pineMat, count);
    let nl = 0, np = 0, nt = 0;
    const m4 = new THREE.Matrix4(), quat = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < count; i++) {
      let x = 0, z = 0;
      for (let tries = 0; tries < 20; tries++) {
        const a = rnd() * Math.PI * 2, r = 64 + rnd() * 120;
        x = Math.cos(a) * r * 1.15; z = Math.sin(a) * r;
        if (!(Math.abs(x) < 34 && Math.abs(z) < 62)) break; // keep bleacher/scoreboard sight lines open
      }
      const s = 0.85 + rnd() * 0.75;
      quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * Math.PI * 2);
      sc.set(s, s * (0.9 + rnd() * 0.3), s);
      const ox = Math.max(0, Math.abs(x) - 58), oz = Math.max(0, Math.abs(z) - 50);
      const n = fbm((x + 2000) / 90, (z + 2000) / 90, 1000, 4, 21);
      const h = THREE.MathUtils.smoothstep(Math.hypot(ox, oz), 0, 70) * (n * 26 + 3) - 0.2;
      ps.set(x, h, z);
      m4.compose(ps, quat, sc);
      trunks.setMatrixAt(nt++, m4);
      const tint = new THREE.Color().setHSL(0.25 + rnd() * 0.08, 0.5 + rnd() * 0.2, 0.32 + rnd() * 0.12);
      if (rnd() < 0.62) { leaves.setMatrixAt(nl, m4); leaves.setColorAt(nl, tint); nl++; }
      else { pines.setMatrixAt(np, m4); pines.setColorAt(np, tint.offsetHSL(0.03, 0, -0.08)); np++; }
    }
    trunks.count = nt; leaves.count = nl; pines.count = np;
    this.root.add(trunks, leaves, pines);

    // ---- distant mountain skyline ----
    const mGeo = new THREE.CylinderGeometry(470, 470, 1, 160, 6, true);
    const mp = mGeo.getAttribute("position") as THREE.BufferAttribute;
    const mcol = new Float32Array(mp.count * 3);
    for (let i = 0; i < mp.count; i++) {
      const x = mp.getX(i), z = mp.getZ(i), yv = mp.getY(i) + 0.5; // 0..1
      const a = Math.atan2(z, x);
      const peak = 60 + fbm(a * 3 + 10, 1, 1000, 5, 8) * 150;
      const y = -10 + yv * peak;
      const inset = 1 - yv * 0.08;
      mp.setXYZ(i, x * inset, y, z * inset);
      const c = new THREE.Color(0x5f8a6a).lerp(new THREE.Color(0x9fb4c4), yv * 0.9);
      mcol[i * 3] = c.r; mcol[i * 3 + 1] = c.g; mcol[i * 3 + 2] = c.b;
    }
    mGeo.setAttribute("color", new THREE.BufferAttribute(mcol, 3));
    mGeo.computeVertexNormals();
    const mMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.BackSide });
    this.disposables.push(mGeo, mMat);
    this.root.add(new THREE.Mesh(mGeo, mMat));
    void aniso;
  }

  private buildScoreboard() {
    const { c, ctx } = scoreboardCanvas();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.4, metalness: 0.6 });
    this.disposables.push(tex, mat, frameMat);
    for (const side of [-1, 1]) {
      const g = new THREE.Group();
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(16, 6), mat);
      screen.position.z = 0.26;
      const frame = new THREE.Mesh(new THREE.BoxGeometry(16.8, 6.8, 0.5), frameMat);
      frame.castShadow = this.quality !== "low";
      g.add(frame, screen);
      for (const sx of [-5, 5]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.5, 9, 0.5), frameMat); leg.position.set(sx, -7, 0); g.add(leg); }
      g.position.set(side * (PB.ARENA_X + 14), 11.5, 0);
      g.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      this.root.add(g);
    }
    const board = { ctx, tex, key: "" };
    return board;
  }

  setScoreboard(scores: [number, number], seconds: number, label: string) {
    const key = scores.join(":") + "|" + seconds + "|" + label;
    if (key === this.board.key) return;
    const prev = this.board.key;
    this.board.key = key;
    if (prev && prev.split("|")[0] !== key.split("|")[0] && this.crowd) this.crowd.cheer = 2.2;
    const ctx = this.board.ctx, W = 1024, H = 384;
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#04111f"); g.addColorStop(1, "#13051a");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#22d3ee"; ctx.fillRect(0, 0, W / 2, 10);
    ctx.fillStyle = "#f0479a"; ctx.fillRect(W / 2, 0, W / 2, 10);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = "900 46px system-ui, sans-serif"; ctx.fillStyle = "#ffffff";
    ctx.fillText("PRISM PAINTBALL", W / 2, 58);
    ctx.font = "900 170px system-ui, sans-serif";
    ctx.fillStyle = "#22d3ee"; ctx.fillText(String(scores[0]), W * 0.2, 225);
    ctx.fillStyle = "#f0479a"; ctx.fillText(String(scores[1]), W * 0.8, 225);
    ctx.font = "800 92px ui-monospace, monospace"; ctx.fillStyle = "#fef08a";
    const m = Math.floor(seconds / 60), s = seconds % 60;
    ctx.fillText(`${m}:${String(s).padStart(2, "0")}`, W / 2, 210);
    ctx.font = "800 34px system-ui, sans-serif"; ctx.fillStyle = "#cbd5e1";
    ctx.fillText(label, W / 2, 300);
    ctx.font = "800 30px system-ui, sans-serif";
    ctx.fillStyle = "#67e8f9"; ctx.fillText("CYAN", W * 0.2, 330);
    ctx.fillStyle = "#f9a8d4"; ctx.fillText("MAGENTA", W * 0.8, 330);
    this.board.tex.needsUpdate = true;
  }

  private buildGrass() {
    const blade = new THREE.BufferGeometry();
    const w = 0.07, h = 0.55;
    blade.setAttribute("position", new THREE.Float32BufferAttribute([-w, 0, 0, w, 0, 0, -w * 0.6, h * 0.5, 0, w * 0.6, h * 0.5, 0, 0, h, 0], 3));
    blade.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 0.5, 1, 0.5, 0.5, 1], 2));
    blade.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4]);
    blade.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: 0x6fae4a, roughness: 0.9, side: THREE.DoubleSide });
    const timeU = this.flagUniform;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = timeU;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uTime;\nvarying float vTip;")
        .replace("#include <begin_vertex>", `#include <begin_vertex>
          vec3 ip = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]);
          float sway = sin(uTime * 1.8 + ip.x * 0.35 + ip.z * 0.22) * 0.5 + sin(uTime * 3.1 + ip.x * 1.3) * 0.18;
          transformed.x += sway * uv.y * uv.y * 0.22;
          transformed.z += sway * uv.y * uv.y * 0.1;
          vTip = uv.y;`);
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying float vTip;")
        .replace("#include <color_fragment>", "#include <color_fragment>\n diffuseColor.rgb *= mix(0.45, 1.25, vTip);");
    };
    const N = 26000;
    const mesh = new THREE.InstancedMesh(blade, mat, N);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    let n = 0, seed = 99;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < N * 3 && n < N; i++) {
      const x = (rnd() - 0.5) * 150, z = (rnd() - 0.5) * 120;
      const inside = Math.abs(x) < PB.ARENA_X + 1.2 && Math.abs(z) < PB.ARENA_Z + 1.2;
      const bleacher = Math.abs(x) < 22 && Math.abs(z) > PB.ARENA_Z + 2 && Math.abs(z) < PB.ARENA_Z + 12;
      if (inside || bleacher) continue;
      const clump = fbm(x / 9 + 100, z / 9 + 100, 1000, 2, 5);
      if (clump < 0.42) continue;
      q.setFromAxisAngle(up, rnd() * Math.PI);
      const sc = 0.6 + rnd() * 0.9 * clump;
      s.set(sc, sc * (0.7 + rnd() * 0.8), sc);
      p.set(x, -0.02, z);
      m4.compose(p, q, s);
      mesh.setMatrixAt(n++, m4);
    }
    mesh.count = n;
    mesh.receiveShadow = true;
    this.root.add(mesh);
    this.disposables.push(blade, mat);
  }

  private buildClouds() {
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: 0xdde8f5, emissiveIntensity: 0.45, fog: false });
    this.disposables.push(mat);
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 7; i++) {
      const g = new THREE.SphereGeometry(6 + Math.random() * 5, 14, 10);
      g.translate((i - 3) * 6.5 + Math.random() * 3, Math.random() * 3, Math.random() * 6 - 3);
      parts.push(g);
    }
    const cloudGeo = mergeGeometries(parts) as THREE.BufferGeometry;
    cloudGeo.scale(1, 0.55, 0.8);
    this.disposables.push(cloudGeo);
    const clouds: THREE.Mesh[] = [];
    for (let i = 0; i < 14; i++) {
      const c = new THREE.Mesh(cloudGeo, mat);
      const a = (i / 14) * Math.PI * 2 + Math.random() * 0.3, r = 260 + Math.random() * 260;
      c.position.set(Math.cos(a) * r, 110 + Math.random() * 70, Math.sin(a) * r);
      c.rotation.y = Math.random() * Math.PI;
      const s = 0.8 + Math.random() * 0.9;
      c.scale.set(s, s, s);
      clouds.push(c);
      this.root.add(c);
    }
    this.updaters.push((dt) => {
      for (const c of clouds) { c.position.x += dt * 2.2; if (c.position.x > 560) c.position.x = -560; }
    });
  }

  /** Re-centre the shadow camera on the action (snapped to texels to avoid shimmering). */
  focusShadows(x: number, z: number) {
    if (!this.sun.castShadow) return;
    const cam = this.sun.shadow.camera;
    const texel = (cam.right - cam.left) / this.sun.shadow.mapSize.x;
    const fx = Math.round(x / texel) * texel, fz = Math.round(z / texel) * texel;
    this.sun.target.position.set(fx, 0, fz);
    this.sun.position.set(fx + SUN_DIR.x * 100, SUN_DIR.y * 100, fz + SUN_DIR.z * 100);
    this.sun.target.updateMatrixWorld();
  }

  update(dt: number, t: number) {
    this.flagUniform.value = t;
    for (const u of this.updaters) u(dt, t);
    const crowd = this.crowd;
    if (crowd) {
      crowd.cheer = Math.max(0, crowd.cheer - dt);
      const m = new THREE.Matrix4(), off = new THREE.Matrix4();
      const amp = 0.04 + crowd.cheer * 0.18;
      for (let i = 0; i < crowd.mesh.count; i++) {
        const y = Math.abs(Math.sin(t * (crowd.cheer > 0 ? 9 : 2.2) + crowd.phase[i])) * amp;
        off.makeTranslation(0, y, 0);
        m.multiplyMatrices(off, crowd.base[i]);
        crowd.mesh.setMatrixAt(i, m);
      }
      crowd.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  /** Merge static meshes that share a material to cut draw calls. */
  batchStatic() {
    const groups = new Map<THREE.Material, THREE.Mesh[]>();
    this.root.updateMatrixWorld(true);
    for (const child of this.root.children.slice()) {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh || !mesh.userData.static || Array.isArray(mesh.material) || (mesh as unknown as THREE.InstancedMesh).isInstancedMesh) continue;
      const list = groups.get(mesh.material as THREE.Material) || [];
      list.push(mesh);
      groups.set(mesh.material as THREE.Material, list);
    }
    groups.forEach((list, material) => {
      if (list.length < 2) return;
      const cast = list.some((m) => m.castShadow);
      const geos: THREE.BufferGeometry[] = [];
      for (const m of list) {
        let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
        for (const name of Object.keys(g.attributes)) if (name !== "position" && name !== "normal" && name !== "uv") g.deleteAttribute(name);
        if (!g.getAttribute("uv")) g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(g.getAttribute("position").count * 2), 2));
        if (!g.getAttribute("normal")) g.computeVertexNormals();
        g.applyMatrix4(m.matrixWorld);
        geos.push(g);
      }
      const merged = mergeGeometries(geos);
      geos.forEach((g) => g.dispose());
      if (!merged) return;
      for (const m of list) { this.root.remove(m); m.geometry.dispose(); }
      const mesh = new THREE.Mesh(merged, material);
      mesh.castShadow = cast && this.quality !== "low";
      mesh.receiveShadow = true;
      this.root.add(mesh);
      this.disposables.push(merged);
    });
  }

  dispose() {
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (mat) (Array.isArray(mat) ? mat : [mat]).forEach((x) => x.dispose());
    });
    for (const d of this.disposables) { try { d.dispose(); } catch { /* ignore */ } }
    this.scene.remove(this.root);
    this.scene.environment = null;
    this.scene.fog = null;
  }
}

export function colliderCount(): number { return MAP.colliders.length; }
export type { Collider };
