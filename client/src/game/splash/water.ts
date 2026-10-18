// Animal Splash — stylized pond water: gentle waves, splash ripples with foam, sky reflection and sun glints.
// heightAt() mirrors the shader so floating things bob on the same surface you see.
import * as THREE from "three";

export const MAX_RIPPLES = 8;
export type Ripple = { x: number; z: number; t0: number; power: number };

const WAVES = `
float baseWaves(vec2 p, float t){ return 0.06*sin(p.x*0.7+t*1.2) + 0.045*sin(p.y*0.9-t*1.05) + 0.03*sin((p.x+p.y)*1.6+t*1.9) + 0.015*sin((p.x-p.y)*3.1+t*2.7); }
float ripples(vec2 p, float t, out float foam){
  float h = 0.0; foam = 0.0;
  for (int i = 0; i < ${MAX_RIPPLES}; i++) {
    vec4 r = uRip[i]; float age = t - r.z; if (age < 0.0 || age > 7.0 || r.w <= 0.0) continue;
    float d = distance(p, r.xy); float k = d - age * 2.6;
    float env = exp(-age * 0.75) * exp(-k * k * 0.45) * r.w / (1.0 + d * 0.25);
    h += env * sin(k * 4.2) * 0.42;
    foam += env * smoothstep(0.35, 1.0, cos(k * 4.2));
  }
  return h;
}`;

export function makeWater(opts: { deep: number; shallow: number; sky: number; foam: number; sun: THREE.Vector3; radius: number; center?: [number, number] }) {
  const uRip: THREE.Vector4[] = Array.from({ length: MAX_RIPPLES }, () => new THREE.Vector4(0, 0, -99, 0));
  const mat = new THREE.ShaderMaterial({
    fog: true, transparent: false,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uTime: { value: 0 }, uDeep: { value: new THREE.Color(opts.deep) }, uShallow: { value: new THREE.Color(opts.shallow) }, uSky: { value: new THREE.Color(opts.sky) },
      uFoam: { value: new THREE.Color(opts.foam) }, uSun: { value: opts.sun.clone().normalize() }, uRadius: { value: opts.radius }, uCenter: { value: new THREE.Vector2(...(opts.center ?? [0, 0])) }, uRip: { value: uRip },
    }]),
    vertexShader: `
      uniform float uTime; uniform vec4 uRip[${MAX_RIPPLES}];
      varying vec3 vW; varying float vFoam;
      #include <fog_pars_vertex>
      ${WAVES}
      void main(){
        vec4 w = modelMatrix * vec4(position, 1.0);
        float f; w.y += baseWaves(w.xz, uTime) + ripples(w.xz, uTime, f);
        vW = w.xyz; vFoam = f;
        vec4 mvPosition = viewMatrix * w;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform float uTime; uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uSky; uniform vec3 uFoam; uniform vec3 uSun; uniform float uRadius; uniform vec2 uCenter;
      varying vec3 vW; varying float vFoam;
      #include <fog_pars_fragment>
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){
        vec3 n = normalize(cross(dFdx(vW), dFdy(vW))); if (n.y < 0.0) n = -n;
        vec3 v = normalize(cameraPosition - vW);
        float r = length(vW.xz - uCenter);
        float shore = smoothstep(uRadius * 0.45, uRadius * 1.02, r);
        vec3 base = mix(uDeep, uShallow, shore);
        float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
        vec3 col = mix(base, uSky, clamp(fres * 0.85 + 0.08, 0.0, 1.0));
        float spec = pow(max(dot(reflect(-uSun, n), v), 0.0), 90.0);
        col += vec3(1.0, 0.97, 0.88) * spec * 1.6;
        // soft caustic shimmer + little sparkles
        vec2 g = vW.xz * 1.7 + vec2(uTime * 0.25, -uTime * 0.2);
        float c = sin(g.x) * sin(g.y * 1.3 + sin(g.x * 0.7 + uTime)) ; col += uShallow * 0.12 * smoothstep(0.55, 1.0, c);
        float sp = step(0.9965, hash(floor(vW.xz * 9.0) + floor(uTime * 3.0))); col += vec3(1.0) * sp * 0.5 * (1.0 - shore * 0.5);
        col = mix(col, uFoam, clamp(vFoam * 1.4, 0.0, 0.9));
        col = mix(col, uFoam, smoothstep(uRadius * 0.93, uRadius * 1.06, r) * 0.35);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  return { mat, uRip };
}

/** JavaScript twin of the shader's surface height (for bobbing rafts, lily pads and splash drops). */
export function heightAt(x: number, z: number, t: number, ripples: Ripple[]) {
  let h = 0.06 * Math.sin(x * 0.7 + t * 1.2) + 0.045 * Math.sin(z * 0.9 - t * 1.05) + 0.03 * Math.sin((x + z) * 1.6 + t * 1.9) + 0.015 * Math.sin((x - z) * 3.1 + t * 2.7);
  for (const r of ripples) {
    const age = t - r.t0; if (age < 0 || age > 7 || r.power <= 0) continue;
    const d = Math.hypot(x - r.x, z - r.z), k = d - age * 2.6;
    h += Math.exp(-age * 0.75) * Math.exp(-k * k * 0.45) * r.power / (1 + d * 0.25) * Math.sin(k * 4.2) * 0.42;
  }
  return h;
}
