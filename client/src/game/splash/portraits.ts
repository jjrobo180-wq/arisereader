// Animal Splash — little snapshots of the 3D animals for the picker tray (rendered once, then cached as images).
import * as THREE from "three";
import { makeCreature } from "./creatures";

const cache = new Map<string, Promise<string>>();
let queue: { id: string; resolve: (url: string) => void }[] = [];
let renderer: THREE.WebGLRenderer | null = null; let busy = false; let idleTimer = 0;

function snap(id: string) {
  const S = 320;
  if (!renderer) { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); renderer.setPixelRatio(1); renderer.setSize(S, S, false); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.05; renderer.setClearColor(0x000000, 0); }
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xeaf8ff, 0x7fb06a, 1.25));
  const sun = new THREE.DirectionalLight(0xfff2d8, 2.4); sun.position.set(-3, 6, 7); scene.add(sun);
  const rim = new THREE.DirectionalLight(0xbfe8ff, 1.2); rim.position.set(5, 3, -4); scene.add(rim);
  const c = makeCreature(id); c.update({ dt: 1 / 30, t: 0.6, swim: 0, happy: 0, oops: 0 }); scene.add(c.g);
  c.g.rotation.y = 0.55; c.g.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(c.g); const ctr = box.getCenter(new THREE.Vector3()); const size = box.getSize(new THREE.Vector3());
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100); const r = Math.max(size.x, size.y, size.z) * 0.62;
  const dir = new THREE.Vector3(0, 0.38, 1).normalize(); cam.position.copy(ctr).addScaledVector(dir, r / Math.tan(THREE.MathUtils.degToRad(15)) * 1.02); cam.lookAt(ctr);
  renderer.render(scene, cam);
  const url = renderer.domElement.toDataURL("image/png");
  scene.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); });
  return url;
}
function pump() {
  if (busy) return; busy = true;
  const step = () => {
    const job = queue.shift();
    if (!job) { busy = false; window.clearTimeout(idleTimer); idleTimer = window.setTimeout(() => { if (!queue.length && renderer) { renderer.dispose(); renderer.forceContextLoss(); renderer = null; } }, 4000); return; }
    let url = ""; try { url = snap(job.id); } catch { url = ""; }
    job.resolve(url); window.setTimeout(step, 16);
  };
  step();
}
/** A data-URL picture of the 3D animal (empty string if 3D isn't available). */
export function portrait(id: string): Promise<string> {
  let p = cache.get(id);
  if (!p) { p = new Promise<string>(resolve => { queue.push({ id, resolve }); }); cache.set(id, p); window.setTimeout(pump, 0); }
  return p;
}
