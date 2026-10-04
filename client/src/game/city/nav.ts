// Turn-by-turn directions drawn in the world: a glowing arrow trail along the
// streets to where you're going, and a light beam over the place itself.
import * as THREE from "three";

type P = [number, number];

function chevronTexture() {
  const c = document.createElement("canvas"); c.width = 64; c.height = 64;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, 64, 64);
  g.fillStyle = "rgba(62,230,255,.35)"; g.fillRect(6, 0, 52, 64);
  g.strokeStyle = "#e6fcff"; g.lineWidth = 9; g.lineCap = "round"; g.lineJoin = "round";
  g.beginPath(); g.moveTo(14, 44); g.lineTo(32, 20); g.lineTo(50, 44); g.stroke();
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class NavRoute {
  readonly group = new THREE.Group();
  private tex = chevronTexture();
  private mat = new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  private ribbon: THREE.Mesh | null = null;
  private beacon: THREE.Group;
  private beamMat = new THREE.MeshBasicMaterial({ color: 0x3ee6ff, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  private ringMat = new THREE.MeshBasicMaterial({ color: 0x3ee6ff, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide });

  constructor(scene: THREE.Scene) {
    this.group.visible = false;
    this.beacon = new THREE.Group();
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.4, 60, 16, 1, true), this.beamMat); beam.position.y = 30; this.beacon.add(beam);
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.4, 3.2, 40), this.ringMat); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.16; this.beacon.add(ring);
    this.group.add(this.beacon);
    scene.add(this.group);
  }

  set(points: P[] | null) {
    if (this.ribbon) { this.group.remove(this.ribbon); this.ribbon.geometry.dispose(); this.ribbon = null; }
    if (!points || points.length < 2) { this.group.visible = false; return; }
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    const half = 1.1, y = 0.13;
    let u = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const [ax, az] = points[i], [bx, bz] = points[i + 1];
      const len = Math.hypot(bx - ax, bz - az); if (len < 0.01) continue;
      const nx = -(bz - az) / len * half, nz = (bx - ax) / len * half;
      const base = pos.length / 3;
      pos.push(ax + nx, y, az + nz, ax - nx, y, az - nz, bx + nx, y, bz + nz, bx - nx, y, bz - nz);
      // arrows point along the route: v runs with the direction of travel
      const u1 = u + len / 3;
      uv.push(0, u, 1, u, 0, u1, 1, u1);
      idx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
      u = u1;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    this.ribbon = new THREE.Mesh(g, this.mat);
    this.ribbon.renderOrder = 2; this.ribbon.frustumCulled = false;
    this.group.add(this.ribbon);
    const [tx, tz] = points[points.length - 1];
    this.beacon.position.set(tx, 0, tz);
    this.group.visible = true;
  }

  update(t: number) {
    if (!this.group.visible) return;
    this.tex.offset.y = -((t * 1.6) % 1);
    this.ringMat.opacity = 0.5 + Math.sin(t * 4) * 0.3;
    this.beacon.children[1].scale.setScalar(1 + (t % 1.2) * 0.3);
  }

  dispose() { this.set(null); this.tex.dispose(); this.mat.dispose(); this.beamMat.dispose(); this.ringMat.dispose(); }
}
