// Skybound Sprint — particles (sparkles, dust, confetti, weather) and flying debris.
import * as THREE from "three";

const MAX = 1800;
type Burst = { color?: number | number[]; count?: number; speed?: number; life?: number; size?: number; gravity?: number; up?: number; spreadZ?: number; drag?: number; additive?: boolean };

export class Fx {
  points: THREE.Points;
  private pos = new Float32Array(MAX * 3); private col = new Float32Array(MAX * 3); private size = new Float32Array(MAX); private alpha = new Float32Array(MAX);
  private vel = new Float32Array(MAX * 3); private life = new Float32Array(MAX); private maxLife = new Float32Array(MAX); private grav = new Float32Array(MAX); private drag = new Float32Array(MAX); private baseSize = new Float32Array(MAX);
  private next = 0;
  private debris: THREE.InstancedMesh; private dState: { x: number; y: number; z: number; vx: number; vy: number; vz: number; r: number; vr: number; t: number }[] = [];
  private tmp = new THREE.Object3D(); private c = new THREE.Color();

  constructor(parent: THREE.Object3D, pixelRatio: number) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(this.col, 3));
    g.setAttribute("psize", new THREE.BufferAttribute(this.size, 1));
    g.setAttribute("alpha", new THREE.BufferAttribute(this.alpha, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { scale: { value: 300 * pixelRatio } },
      vertexShader: "attribute float psize; attribute float alpha; attribute vec3 color; varying vec3 vC; varying float vA; uniform float scale; void main(){ vC=color; vA=alpha; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=psize*scale/max(1.,-mv.z); gl_Position=projectionMatrix*mv; }",
      fragmentShader: "varying vec3 vC; varying float vA; void main(){ vec2 d=gl_PointCoord-.5; float r=length(d); if(r>.5) discard; float a=smoothstep(.5,.0,r); gl_FragColor=vec4(vC*(0.6+a*0.8), a*vA); }",
    });
    this.points = new THREE.Points(g, mat); this.points.frustumCulled = false; parent.add(this.points);
    for (let i = 0; i < MAX; i++) this.life[i] = 0;
    this.debris = new THREE.InstancedMesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), new THREE.MeshStandardMaterial({ color: 0xe07f42, roughness: 0.7 }), 80);
    this.debris.frustumCulled = false; this.debris.castShadow = true; parent.add(this.debris);
    for (let i = 0; i < 80; i++) { this.dState.push({ x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0, r: 0, vr: 0, t: 99 }); }
    this.syncDebris();
  }

  burst(x: number, y: number, z: number, o: Burst = {}) {
    const n = o.count ?? 12, sp = o.speed ?? 4, life = o.life ?? 0.6, size = o.size ?? 0.25, colors = Array.isArray(o.color) ? o.color : [o.color ?? 0xffffff];
    for (let k = 0; k < n; k++) {
      const i = this.next; this.next = (this.next + 1) % MAX;
      const a = Math.random() * Math.PI * 2, v = sp * (0.4 + Math.random() * 0.8);
      this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
      this.vel[i * 3] = Math.cos(a) * v; this.vel[i * 3 + 1] = Math.sin(a) * v + (o.up ?? 0); this.vel[i * 3 + 2] = (Math.random() - 0.5) * (o.spreadZ ?? sp);
      this.c.setHex(colors[k % colors.length]); this.col[i * 3] = this.c.r; this.col[i * 3 + 1] = this.c.g; this.col[i * 3 + 2] = this.c.b;
      this.life[i] = this.maxLife[i] = life * (0.6 + Math.random() * 0.6); this.grav[i] = o.gravity ?? 6; this.drag[i] = o.drag ?? 1.5; this.baseSize[i] = size * (0.6 + Math.random() * 0.8);
    }
  }
  /** a single drifting particle (weather, trails) */
  one(x: number, y: number, z: number, vx: number, vy: number, color: number, life: number, size: number, gravity = 0) {
    const i = this.next; this.next = (this.next + 1) % MAX;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z; this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = 0;
    this.c.setHex(color); this.col[i * 3] = this.c.r; this.col[i * 3 + 1] = this.c.g; this.col[i * 3 + 2] = this.c.b;
    this.life[i] = this.maxLife[i] = life; this.grav[i] = gravity; this.drag[i] = 0; this.baseSize[i] = size;
  }
  bricks(x: number, y: number, color = 0xe07f42) {
    (this.debris.material as THREE.MeshStandardMaterial).color.setHex(color);
    let n = 0;
    for (const d of this.dState) {
      if (d.t < 1.4) continue;
      d.x = x + (n % 2 ? 0.25 : -0.25); d.y = y + (n < 2 ? 0.25 : -0.25); d.z = (Math.random() - 0.5) * 0.6;
      d.vx = (n % 2 ? 1 : -1) * (2 + Math.random() * 2); d.vy = 7 + Math.random() * 4 - (n < 2 ? 0 : 2); d.vz = (Math.random() - 0.5) * 3; d.r = 0; d.vr = (Math.random() - 0.5) * 14; d.t = 0;
      if (++n >= 4) break;
    }
  }
  private syncDebris() {
    this.dState.forEach((d, i) => {
      this.tmp.position.set(d.x, d.y, d.z); this.tmp.rotation.set(d.r, d.r * 0.7, 0); this.tmp.scale.setScalar(d.t < 1.4 ? 1 : 0); this.tmp.updateMatrix();
      this.debris.setMatrixAt(i, this.tmp.matrix);
    });
    this.debris.instanceMatrix.needsUpdate = true;
  }

  update(dt: number) {
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; this.size[i] = 0; continue; }
      this.life[i] -= dt;
      const k = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i * 3] *= k; this.vel[i * 3 + 2] *= k; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * k - this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const f = this.life[i] / this.maxLife[i];
      this.alpha[i] = Math.min(1, f * 2.5); this.size[i] = this.baseSize[i] * (0.4 + 0.6 * f);
    }
    const g = this.points.geometry;
    (g.attributes.position as THREE.BufferAttribute).needsUpdate = true; (g.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    (g.attributes.psize as THREE.BufferAttribute).needsUpdate = true; (g.attributes.alpha as THREE.BufferAttribute).needsUpdate = true;
    let any = false;
    for (const d of this.dState) { if (d.t >= 1.4) continue; any = true; d.t += dt; d.vy -= 30 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt; d.r += d.vr * dt; }
    if (any || this.dState.some(d => d.t < 1.6)) this.syncDebris();
  }

  /** ambient weather around the camera */
  ambient(kind: string, cx: number, cy: number, dt: number) {
    const rate = kind === "rain" ? 90 : kind === "snow" ? 40 : kind === "none" ? 0 : 14;
    let n = rate * dt; while (n > 0) {
      if (Math.random() > n) break; n -= 1;
      const x = cx + (Math.random() - 0.5) * 44, y = cy + (Math.random() - 0.3) * 26, z = (Math.random() - 0.6) * 10;
      if (kind === "rain") this.one(x + 4, cy + 14, z, -4, -26, 0x9fb4ff, 1.1, 0.09);
      else if (kind === "snow") this.one(x, cy + 13, z, -0.6 + Math.random() * 0.4, -1.8, 0xffffff, 7, 0.16);
      else if (kind === "pollen") this.one(x, y, z, 0.3, 0.2, 0xfff3a0, 4, 0.11);
      else if (kind === "embers") this.one(x, cy - 10, z, 0.6, 2.2, 0xffa24a, 6, 0.12);
      else if (kind === "wind") this.one(cx - 24, y, z, 16, 0, 0xffffff, 3, 0.07);
      else if (kind === "sparkle") this.one(x, y, z, 0, 0.3, Math.random() < 0.5 ? 0xb388ff : 0x7fe7ff, 2.5, 0.13);
    }
  }
  dispose() { this.points.geometry.dispose(); (this.points.material as THREE.Material).dispose(); this.debris.geometry.dispose(); (this.debris.material as THREE.Material).dispose(); }
}
