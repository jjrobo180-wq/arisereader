'use strict';
/* Small cel-shading 3D engine: toon lighting, ink outlines, painted sky, bloom, particles, synth audio. */
const E = {};
(() => {
const { sin, cos, sqrt, abs, PI, floor, exp, hypot } = Math;
const mx = Math.max, mn = Math.min;

E.clamp = (x, a, b) => x < a ? a : x > b ? b : x;
E.lerp = (a, b, t) => a + (b - a) * t;
E.damp = (a, b, k, dt) => a + (b - a) * (1 - exp(-k * dt));
E.hex = h => { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255]; };
E.mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
E.mul3 = (a, f) => [a[0] * f, a[1] * f, a[2] * f];
E.norm = v => { const l = hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
E.rand = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
E.angDiff = (a, b) => { let d = (b - a) % (2 * PI); if (d > PI) d -= 2 * PI; if (d < -PI) d += 2 * PI; return d; };
E.rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
E.ease = t => t * t * (3 - 2 * t);

// ───────────────────────── matrices (column-major) ─────────────────────────
const M4 = E.M4 = {
  create() { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; },
  mul(o, a, b) {
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3], a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
      a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11], a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    for (let i = 0; i < 16; i += 4) {
      const b0 = b[i], b1 = b[i + 1], b2 = b[i + 2], b3 = b[i + 3];
      o[i] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
      o[i + 1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
      o[i + 2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
      o[i + 3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    }
    return o;
  },
  // rotation order: yaw (y) * pitch (x) * roll (z)
  trs(o, p, r, s) {
    const cx = cos(r[0]), sx = sin(r[0]), cy = cos(r[1]), sy = sin(r[1]), cz = cos(r[2]), sz = sin(r[2]);
    o[0] = (cy * cz + sy * sx * sz) * s[0]; o[1] = (cx * sz) * s[0]; o[2] = (-sy * cz + cy * sx * sz) * s[0]; o[3] = 0;
    o[4] = (-cy * sz + sy * sx * cz) * s[1]; o[5] = (cx * cz) * s[1]; o[6] = (sy * sz + cy * sx * cz) * s[1]; o[7] = 0;
    o[8] = (sy * cx) * s[2]; o[9] = (-sx) * s[2]; o[10] = (cy * cx) * s[2]; o[11] = 0;
    o[12] = p[0]; o[13] = p[1]; o[14] = p[2]; o[15] = 1;
    return o;
  },
  T(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1) { return M4.trs(M4.create(), [x, y, z], [rx, ry, rz], [s, s, s]); },
  perspective(o, fovy, asp, n, f) {
    const t = 1 / Math.tan(fovy / 2); o.fill(0);
    o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = 2 * f * n / (n - f); return o;
  },
  lookAt(o, e, c, u) {
    let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2]; let l = hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
    let xx = u[1] * zz - u[2] * zy, xy = u[2] * zx - u[0] * zz, xz = u[0] * zy - u[1] * zx; l = hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    o[0] = xx; o[1] = yx; o[2] = zx; o[3] = 0; o[4] = xy; o[5] = yy; o[6] = zy; o[7] = 0; o[8] = xz; o[9] = yz; o[10] = zz; o[11] = 0;
    o[12] = -(xx * e[0] + xy * e[1] + xz * e[2]); o[13] = -(yx * e[0] + yy * e[1] + yz * e[2]); o[14] = -(zx * e[0] + zy * e[1] + zz * e[2]); o[15] = 1;
    return o;
  },
};
/** m * translate(x,y,z): move in the local frame of m. */
E.at = (m, x, y, z) => M4.mul(M4.create(), m, M4.T(x, y, z));

// ───────────────────────── geometry builder ─────────────────────────
// 12 floats per vertex: position, normal, colour, smoothed normal (for the ink outline)
class Geo {
  constructor() { this.v = []; }
  _c(col, t) { return Array.isArray(col) ? col : E.mix3(col.b, col.t, E.clamp(t, 0, 1)); }
  _tri(m, a, b, c, na, nb, nc, ca, cb, cc) {
    const P = p => m ? [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]] : p;
    const N = n => { if (!m) return n; const x = m[0] * n[0] + m[4] * n[1] + m[8] * n[2], y = m[1] * n[0] + m[5] * n[1] + m[9] * n[2], z = m[2] * n[0] + m[6] * n[1] + m[10] * n[2]; const l = hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
    const A = P(a), B = P(b), C = P(c), NA = N(na), NB = N(nb), NC = N(nc);
    const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
    const gx = uy * vz - uz * vy, gy = uz * vx - ux * vz, gz = ux * vy - uy * vx;
    if (gx * gx + gy * gy + gz * gz < 1e-16) return;
    const s = gx * (NA[0] + NB[0] + NC[0]) + gy * (NA[1] + NB[1] + NC[1]) + gz * (NA[2] + NB[2] + NC[2]);
    const v = this.v, push = (p, n, k) => v.push(p[0], p[1], p[2], n[0], n[1], n[2], k[0], k[1], k[2], n[0], n[1], n[2]);
    push(A, NA, ca); if (s >= 0) { push(B, NB, cb); push(C, NC, cc); } else { push(C, NC, cc); push(B, NB, cb); }
  }
  _smooth(start) {
    const v = this.v, map = new Map(), key = i => Math.round(v[i] * 1500) + ',' + Math.round(v[i + 1] * 1500) + ',' + Math.round(v[i + 2] * 1500);
    for (let i = start; i < v.length; i += 12) {
      const k = key(i); let e = map.get(k); if (!e) { e = { n: [0, 0, 0], seen: new Set() }; map.set(k, e); }
      const nk = Math.round(v[i + 3] * 20) + ',' + Math.round(v[i + 4] * 20) + ',' + Math.round(v[i + 5] * 20);
      if (!e.seen.has(nk)) { e.seen.add(nk); e.n[0] += v[i + 3]; e.n[1] += v[i + 4]; e.n[2] += v[i + 5]; }
    }
    for (let i = start; i < v.length; i += 12) { const n = map.get(key(i)).n, l = hypot(n[0], n[1], n[2]) || 1; v[i + 9] = n[0] / l; v[i + 10] = n[1] / l; v[i + 11] = n[2] / l; }
    return this;
  }
  /** Flat quad. `hint` is any direction on the side the face should be seen from. */
  quad(a, b, c, d, col, m, hint = [0, 1, 0], two = false) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let n = E.norm([uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx]);
    if (n[0] * hint[0] + n[1] * hint[1] + n[2] * hint[2] < 0) n = [-n[0], -n[1], -n[2]];
    const s = this.v.length, k = Array.isArray(col) ? [col, col, col, col] : [col.b, col.b, col.t, col.t];
    this._tri(m, a, b, c, n, n, n, k[0], k[1], k[2]); this._tri(m, a, c, d, n, n, n, k[0], k[2], k[3]);
    if (two) { const r = [-n[0], -n[1], -n[2]]; this._tri(m, a, b, c, r, r, r, k[0], k[1], k[2]); this._tri(m, a, c, d, r, r, r, k[0], k[2], k[3]); }
    return this._smooth(s);
  }
  tri(a, b, c, col, m, hint = [0, 1, 0]) { return this.quad(a, b, c, c, col, m, hint); }
  box(w, h, d, col, m) {
    const s = this.v.length, x = w / 2, y = h / 2, z = d / 2, ct = this._c(col, 1), cb = this._c(col, 0);
    const F = [[[-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z], [0, 0, 1]], [[x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z], [0, 0, -1]],
      [[x, -y, z], [x, -y, -z], [x, y, -z], [x, y, z], [1, 0, 0]], [[-x, -y, -z], [-x, -y, z], [-x, y, z], [-x, y, -z], [-1, 0, 0]],
      [[-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z], [0, 1, 0]], [[-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z], [0, -1, 0]]];
    for (const f of F) {
      const n = f[4], k = p => p[1] > 0 ? ct : cb;
      this._tri(m, f[0], f[1], f[2], n, n, n, k(f[0]), k(f[1]), k(f[2])); this._tri(m, f[0], f[2], f[3], n, n, n, k(f[0]), k(f[2]), k(f[3]));
    }
    return this._smooth(s);
  }
  /** Cylinder or cone along Y, centred. rt = top radius, rb = bottom radius. */
  cyl(rt, rb, h, seg, col, m, capT = true, capB = true) {
    const s = this.v.length, y1 = h / 2, y0 = -h / 2, sl = (rb - rt) / h, ct = this._c(col, 1), cb = this._c(col, 0), U = [0, 1, 0], D = [0, -1, 0];
    for (let i = 0; i < seg; i++) {
      const a0 = i / seg * 2 * PI, a1 = (i + 1) / seg * 2 * PI, c0 = cos(a0), s0 = sin(a0), c1 = cos(a1), s1 = sin(a1);
      const n0 = E.norm([c0, sl, s0]), n1 = E.norm([c1, sl, s1]);
      const p00 = [c0 * rb, y0, s0 * rb], p10 = [c1 * rb, y0, s1 * rb], p01 = [c0 * rt, y1, s0 * rt], p11 = [c1 * rt, y1, s1 * rt];
      this._tri(m, p00, p10, p11, n0, n1, n1, cb, cb, ct); this._tri(m, p00, p11, p01, n0, n1, n0, cb, ct, ct);
      if (capT && rt > 1e-6) this._tri(m, [0, y1, 0], p01, p11, U, U, U, ct, ct, ct);
      if (capB && rb > 1e-6) this._tri(m, [0, y0, 0], p10, p00, D, D, D, cb, cb, cb);
    }
    return this._smooth(s);
  }
  /** Ellipsoid. `keep(x,y,z)` (local, unit sphere scaled) can cut parts away. */
  ell(rx, ry, rz, seg, rings, col, m, keep) {
    const s = this.v.length;
    const P = (i, j) => { const th = j / rings * PI, ph = i / seg * 2 * PI, x = sin(th) * cos(ph), y = cos(th), z = sin(th) * sin(ph); return { p: [x * rx, y * ry, z * rz], n: E.norm([x / rx, y / ry, z / rz]), c: this._c(col, (y + 1) / 2) }; };
    for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) {
      const a = P(i, j), b = P(i + 1, j), c = P(i + 1, j + 1), d = P(i, j + 1);
      if (keep && !keep((a.p[0] + c.p[0]) / 2, (a.p[1] + c.p[1]) / 2, (a.p[2] + c.p[2]) / 2)) continue;
      this._tri(m, a.p, b.p, c.p, a.n, b.n, c.n, a.c, b.c, c.c); this._tri(m, a.p, c.p, d.p, a.n, c.n, d.n, a.c, c.c, d.c);
    }
    return this._smooth(s);
  }
  torus(R, r, seg, tube, col, m) {
    const s = this.v.length, c0 = this._c(col, 0.5);
    const P = (i, j) => { const u = i / seg * 2 * PI, w = j / tube * 2 * PI, cx = cos(u), sz = sin(u); return { p: [(R + r * cos(w)) * cx, r * sin(w), (R + r * cos(w)) * sz], n: [cos(w) * cx, sin(w), cos(w) * sz] }; };
    for (let i = 0; i < seg; i++) for (let j = 0; j < tube; j++) {
      const a = P(i, j), b = P(i + 1, j), c = P(i + 1, j + 1), d = P(i, j + 1);
      this._tri(m, a.p, b.p, c.p, a.n, b.n, c.n, c0, c0, c0); this._tri(m, a.p, c.p, d.p, a.n, c.n, d.n, c0, c0, c0);
    }
    return this._smooth(s);
  }
  /** Gabled roof: base w (x) by d (z), height h, ridge along z. Sits on y=0. */
  roof(w, h, d, col, m, over = 0) {
    const x = w / 2 + over, z = d / 2 + over, ct = this._c(col, 1), cb = this._c(col, 0), k = { t: ct, b: cb };
    this.quad([x, 0, z], [x, 0, -z], [0, h, -z], [0, h, z], k, m, [1, 1, 0]);
    this.quad([-x, 0, -z], [-x, 0, z], [0, h, z], [0, h, -z], k, m, [-1, 1, 0]);
    this.tri([-x, 0, z], [x, 0, z], [0, h, z], cb, m, [0, 0, 1]); this.tri([x, 0, -z], [-x, 0, -z], [0, h, -z], cb, m, [0, 0, -1]);
    this.quad([-x, 0, -z], [x, 0, -z], [x, 0, z], [-x, 0, z], cb, m, [0, -1, 0]);
    return this;
  }
  add(g, m) {
    const s = g.v, v = this.v;
    for (let i = 0; i < s.length; i += 12) {
      const x = s[i], y = s[i + 1], z = s[i + 2];
      if (m) {
        v.push(m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]);
        for (const o of [3, 9]) { const a = s[i + o], b = s[i + o + 1], c = s[i + o + 2]; if (o === 9) v.push(s[i + 6], s[i + 7], s[i + 8]); v.push(m[0] * a + m[4] * b + m[8] * c, m[1] * a + m[5] * b + m[9] * c, m[2] * a + m[6] * b + m[10] * c); }
      } else for (let k = 0; k < 12; k++) v.push(s[i + k]);
    }
    return this;
  }
  build() { return new Mesh(E.gl, new Float32Array(this.v)); }
}
E.Geo = Geo;

class Mesh {
  constructor(gl, data) {
    this.count = data.length / 12; this.vao = gl.createVertexArray(); gl.bindVertexArray(this.vao);
    this.buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.buf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    for (let i = 0; i < 4; i++) { gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, 3, gl.FLOAT, false, 48, i * 12); }
    gl.bindVertexArray(null);
  }
}

// ───────────────────────── scene nodes ─────────────────────────
class Node {
  constructor(mesh) { this.p = [0, 0, 0]; this.r = [0, 0, 0]; this.s = [1, 1, 1]; this.mesh = mesh || null; this.kids = []; this.w = M4.create(); this.l = M4.create(); this.visible = true; this.outline = true; this.unlit = false; this.tint = null; this.emis = null; this.two = false; }
  add(n) { this.kids.push(n); return n; }
  update(pw) { M4.trs(this.l, this.p, this.r, this.s); if (pw) M4.mul(this.w, pw, this.l); else this.w.set(this.l); for (const k of this.kids) k.update(this.w); }
  draw(R, o) {
    if (!this.visible) return;
    if (this.mesh) {
      const d = Node._o; d.tint = this.tint || (o && o.tint) || null; d.emis = this.emis || (o && o.emis) || null; d.flash = o ? o.flash || 0 : 0; d.alpha = o && o.alpha !== undefined ? o.alpha : 1;
      d.unlit = this.unlit; d.outline = this.outline && !(o && o.outline === false) ? undefined : false; d.two = this.two;
      R.draw(this.mesh, this.w, d);
    }
    for (const k of this.kids) k.draw(R, o);
  }
}
Node._o = {};
E.Node = Node;

// ───────────────────────── shaders ─────────────────────────
const VS_TOON = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNor; layout(location=2) in vec3 aCol; layout(location=3) in vec3 aSN;
uniform mat4 uModel,uVP; uniform vec3 uCam; uniform vec2 uCurve; uniform float uOutline;
out vec3 vN,vCol,vW;
void main(){
  vec4 w=uModel*vec4(aPos,1.); mat3 nm=mat3(uModel); vN=nm*aNor;
  if(uOutline>0.){vec3 sn=normalize(nm*aSN); float d=distance(w.xyz,uCam); w.xyz+=sn*uOutline*(0.35+d*0.045);}
  vW=w.xyz; float dz=w.z-uCam.z; w.y-=uCurve.x*dz*dz; w.x+=uCurve.y*dz*dz;
  vCol=aCol; gl_Position=uVP*w;
}`;
const FS_TOON = `#version 300 es
precision highp float;
in vec3 vN,vCol,vW;
uniform vec3 uCam,uTint,uEmis,uLightDir,uLightCol,uShadowCol,uRimCol,uFogCol,uOutCol;
uniform float uOutline,uAlpha,uUnlit,uFlash,uFogNear,uFogFar,uUnlitMul;
out vec4 o;
void main(){
  float fog=smoothstep(uFogNear,uFogFar,distance(vW,uCam)); vec3 c;
  if(uOutline>0.){c=uOutCol;}
  else{
    vec3 base=vCol*uTint;
    if(uUnlit>0.5){c=base*uUnlitMul+uEmis;}
    else{
      vec3 n=normalize(vN); if(!gl_FrontFacing)n=-n;
      vec3 v=normalize(uCam-vW); float ndl=dot(n,uLightDir);
      float lit=smoothstep(-0.03,0.03,ndl), hi=smoothstep(0.80,0.84,ndl);
      c=mix(base*uShadowCol,base*uLightCol,lit)+base*hi*0.10;
      float rim=1.-max(dot(n,v),0.);
      c+=uRimCol*smoothstep(0.62,0.72,rim)*(0.12+0.26*lit)*(1.-smoothstep(0.55,0.9,n.y))+uEmis;
    }
    c=mix(c,vec3(1.),uFlash);
  }
  o=vec4(mix(c,uFogCol,fog),uAlpha);
}`;
const VS_FS = `#version 300 es
out vec2 vUV;
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2)); vUV=p; gl_Position=vec4(p*2.-1.,0.,1.);}`;
const FS_SKY = `#version 300 es
precision highp float;
in vec2 vUV;
uniform vec3 uR,uU,uF,uTop,uHor,uBot,uSunDir,uSunCol,uCloudCol,uCloudShade;
uniform float uTan,uAsp,uTime,uSunSize,uCloud,uStars,uMoon,uAurora,uCloudSpeed,uEclipse,uGlow;
out vec4 o;
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*noise(p);p=p*2.03+vec2(17.,9.);a*=.5;}return s;}
void main(){
  vec2 q=vUV*2.-1.;
  vec3 d=normalize(uF+uR*q.x*uTan*uAsp+uU*q.y*uTan);
  float h=d.y;
  vec3 c=mix(uHor,uTop,pow(clamp(h,0.,1.),0.5));
  c=mix(c,uBot,smoothstep(0.02,-0.3,h));
  if(uStars>0.01&&h>-0.05){
    vec2 sp=d.xz/(abs(h)+0.4)*26.; vec2 id=floor(sp); float r=hash(id);
    vec2 f=fract(sp)-.5-(vec2(hash(id+3.1),hash(id+7.7))-.5)*.6;
    float s=smoothstep(0.03+0.07*r,0.,length(f))*step(0.72,r)*(0.55+0.45*sin(uTime*2.5+r*40.));
    c+=vec3(0.9,0.95,1.)*s*uStars;
  }
  if(uAurora>0.01&&h>0.02){
    float a=fbm(vec2(d.x*3.+uTime*0.03,d.z*1.5))*1.6-0.35;
    float band=smoothstep(0.25,0.6,a)*smoothstep(0.75,0.12,h)*smoothstep(0.02,0.2,h);
    c+=mix(vec3(0.1,0.9,0.7),vec3(0.6,0.3,1.),clamp(h*2.2,0.,1.))*band*0.45*uAurora;
  }
  float sd=dot(d,uSunDir);
  c+=uSunCol*(pow(max(sd,0.),90.)*0.55+pow(max(sd,0.),10.)*0.22)*uGlow;
  float disc=smoothstep(uSunSize,uSunSize+0.0012,sd);
  vec3 dc=uSunCol*1.25;
  if(uMoon>0.5){ vec3 off=normalize(uSunDir+uR*0.045+uU*0.02); float cut=smoothstep(uSunSize+0.0006,uSunSize+0.0016,dot(d,off)); dc=mix(dc,c*0.55,cut*0.92); }
  dc=mix(dc,vec3(0.02,0.01,0.05),uEclipse);
  c=mix(c,dc,disc);
  c+=uSunCol*uEclipse*smoothstep(uSunSize-0.0035,uSunSize,sd)*(1.-disc)*1.1;
  if(h>-0.03){
    vec2 cp=d.xz/(h+0.2)*0.85+vec2(uTime*uCloudSpeed,0.);
    float n=fbm(cp), n2=fbm(cp+uSunDir.xz*0.22+vec2(0.,0.1));
    float cov=smoothstep(1.-uCloud,1.-uCloud+0.05,n);
    vec3 cc=mix(uCloudShade,uCloudCol,smoothstep(-0.02,0.06,n-n2));
    cc=mix(cc,uCloudCol,smoothstep(1.-uCloud+0.16,1.-uCloud+0.2,n)*0.5);
    c=mix(c,cc,cov*smoothstep(-0.03,0.1,h));
  }
  o=vec4(c,1.);
}`;
const FS_BRIGHT = `#version 300 es
precision mediump float; in vec2 vUV; uniform sampler2D uTex; uniform float uThresh; out vec4 o;
void main(){vec3 c=texture(uTex,vUV).rgb; float l=max(c.r,max(c.g,c.b)); o=vec4(c*smoothstep(uThresh,uThresh+0.22,l),1.);}`;
const FS_BLUR = `#version 300 es
precision mediump float; in vec2 vUV; uniform sampler2D uTex; uniform vec2 uDir; out vec4 o;
void main(){vec3 c=texture(uTex,vUV).rgb*0.227;
 c+=(texture(uTex,vUV+uDir*1.385).rgb+texture(uTex,vUV-uDir*1.385).rgb)*0.316;
 c+=(texture(uTex,vUV+uDir*3.231).rgb+texture(uTex,vUV-uDir*3.231).rgb)*0.070; o=vec4(c,1.);}`;
const FS_COMP = `#version 300 es
precision highp float; in vec2 vUV; uniform sampler2D uScene,uBloom;
uniform float uBloomAmt,uVig,uFlash,uSat,uLines,uTime,uAberr,uAsp; uniform vec3 uFlashCol,uGrade; out vec4 o;
float hash(float p){return fract(sin(p*127.1)*43758.5453);}
void main(){
  vec2 p=vUV-.5; vec3 c;
  if(uAberr>0.001){vec2 k=p*uAberr; c=vec3(texture(uScene,vUV+k).r,texture(uScene,vUV).g,texture(uScene,vUV-k).b);} else c=texture(uScene,vUV).rgb;
  c+=texture(uBloom,vUV).rgb*uBloomAmt;
  float l=dot(c,vec3(.299,.587,.114)); c=mix(vec3(l),c,uSat)*uGrade;
  c*=1.-uVig*pow(length(p)*1.3,2.4);
  if(uLines>0.001){vec2 pp=vec2(p.x*uAsp,p.y); float a=atan(pp.y,pp.x); float seg=floor(a*38.); float n=hash(seg+floor(uTime*20.)*13.);
    float r=length(pp); float ln=step(0.80,n)*smoothstep(0.34+0.3*hash(seg*3.7),0.95,r)*(1.-abs(fract(a*38.)-.5)*2.);
    c=mix(c,vec3(1.),clamp(ln*uLines,0.,1.));}
  o=vec4(mix(c,uFlashCol,uFlash),1.);
}`;
const VS_PART = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aUV; layout(location=2) in vec4 aCol;
uniform mat4 uVP; uniform vec3 uCam; uniform vec2 uCurve; out vec3 vUV; out vec4 vCol;
void main(){vec3 w=aPos; float dz=w.z-uCam.z; w.y-=uCurve.x*dz*dz; w.x+=uCurve.y*dz*dz; vUV=aUV; vCol=aCol; gl_Position=uVP*vec4(w,1.);}`;
const FS_PART = `#version 300 es
precision mediump float; in vec3 vUV; in vec4 vCol; out vec4 o;
void main(){float d=length(vUV.xy), a=smoothstep(1.,0.,d);
 a=vUV.z<0.5?a*a:(vUV.z<1.5?smoothstep(1.,0.86,d):smoothstep(1.,0.9,abs(vUV.x)+abs(vUV.y)));
 o=vec4(vCol.rgb,vCol.a*a);}`;

function program(gl, vs, fs) {
  const p = gl.createProgram();
  for (const [t, s] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(sh));
    gl.attachShader(p, sh);
  }
  gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
  const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const inf = gl.getActiveUniform(p, i); u[inf.name] = gl.getUniformLocation(p, inf.name); }
  return { p, u };
}

const WHITE = [1, 1, 1], BLACK = [0, 0, 0];
// ───────────────────────── renderer ─────────────────────────
class Renderer {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    const gl = this.gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('This device or browser does not support WebGL 2.');
    E.gl = gl;
    this.toon = program(gl, VS_TOON, FS_TOON); this.sky = program(gl, VS_FS, FS_SKY); this.pBright = program(gl, VS_FS, FS_BRIGHT);
    this.pBlur = program(gl, VS_FS, FS_BLUR); this.pComp = program(gl, VS_FS, FS_COMP); this.pPart = program(gl, VS_PART, FS_PART);
    this.emptyVao = gl.createVertexArray();
    this.view = M4.create(); this.proj = M4.create(); this.vp = M4.create();
    this.cam = { pos: [0, 2, 6], tgt: [0, 1, 0], fov: 60, near: 0.1, far: 500, roll: 0 };
    this.camR = [1, 0, 0]; this.camU = [0, 1, 0]; this.camF = [0, 0, -1];
    this.trans = []; this.outlineW = opts.outline || 0.02; this.time = 0; this.maxDpr = opts.maxDpr || 2; this.post = true;
    this.fx = { flash: 0, flashCol: [1, 1, 1], lines: 0, aberr: 0 };
    this.w = 0; this.h = 0; this.resize();
  }
  resize() {
    const c = this.canvas, dpr = mn(window.devicePixelRatio || 1, this.maxDpr);
    const w = mx(2, floor(c.clientWidth * dpr)), h = mx(2, floor(c.clientHeight * dpr));
    if (w === this.w && h === this.h) return;
    this.w = c.width = w; this.h = c.height = h; this.cssW = c.clientWidth; this.cssH = c.clientHeight;
    const gl = this.gl;
    try {
      for (const k of ['fbMS', 'fbRes', 'fbA', 'fbB']) if (this[k]) gl.deleteFramebuffer(this[k]);
      for (const k of ['rbC', 'rbD']) if (this[k]) gl.deleteRenderbuffer(this[k]);
      for (const k of ['texRes', 'texA', 'texB']) if (this[k]) gl.deleteTexture(this[k]);
      const samples = mn(4, gl.getParameter(gl.MAX_SAMPLES));
      this.fbMS = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbMS);
      this.rbC = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, this.rbC); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.RGBA8, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, this.rbC);
      this.rbD = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, this.rbD); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.DEPTH_COMPONENT24, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.rbD);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('fb');
      const tex = (tw, th) => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, tw, th, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; };
      const fb = t => { const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); return f; };
      this.bw = mx(2, w >> 2); this.bh = mx(2, h >> 2);
      this.texRes = tex(w, h); this.fbRes = fb(this.texRes); this.texA = tex(this.bw, this.bh); this.fbA = fb(this.texA); this.texB = tex(this.bw, this.bh); this.fbB = fb(this.texB);
      this.post = true;
    } catch (e) { this.post = false; }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  begin(env, dt) {
    const gl = this.gl, c = this.cam; this.env = env; this.time += dt || 0; this.resize();
    const asp = this.w / this.h, F = E.norm([c.tgt[0] - c.pos[0], c.tgt[1] - c.pos[1], c.tgt[2] - c.pos[2]]);
    let Rt = E.norm([-F[2], 0, F[0]]); if (abs(F[1]) > 0.999) Rt = [1, 0, 0];
    let U = [Rt[1] * F[2] - Rt[2] * F[1], Rt[2] * F[0] - Rt[0] * F[2], Rt[0] * F[1] - Rt[1] * F[0]];
    if (c.roll) { const cr = cos(c.roll), sr = sin(c.roll), r2 = [Rt[0] * cr + U[0] * sr, Rt[1] * cr + U[1] * sr, Rt[2] * cr + U[2] * sr]; U = [U[0] * cr - Rt[0] * sr, U[1] * cr - Rt[1] * sr, U[2] * cr - Rt[2] * sr]; Rt = r2; }
    this.camR = Rt; this.camU = U; this.camF = F;
    M4.lookAt(this.view, c.pos, c.tgt, U); M4.perspective(this.proj, c.fov * PI / 180, asp, c.near, c.far); M4.mul(this.vp, this.proj, this.view);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.post ? this.fbMS : null); gl.viewport(0, 0, this.w, this.h);
    gl.disable(gl.BLEND); gl.depthMask(true); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // sky
    const s = env.sky, su = this.sky.u; gl.useProgram(this.sky.p); gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.bindVertexArray(this.emptyVao);
    gl.uniform3fv(su.uR, Rt); gl.uniform3fv(su.uU, U); gl.uniform3fv(su.uF, F); gl.uniform1f(su.uTan, Math.tan(c.fov * PI / 360)); gl.uniform1f(su.uAsp, asp); gl.uniform1f(su.uTime, this.time);
    gl.uniform3fv(su.uTop, s.top); gl.uniform3fv(su.uHor, s.hor); gl.uniform3fv(su.uBot, s.bot); gl.uniform3fv(su.uSunDir, s.sunDir); gl.uniform3fv(su.uSunCol, s.sunCol);
    gl.uniform3fv(su.uCloudCol, s.cloudCol); gl.uniform3fv(su.uCloudShade, s.cloudShade); gl.uniform1f(su.uSunSize, s.sunSize); gl.uniform1f(su.uCloud, s.cloud);
    gl.uniform1f(su.uStars, s.stars); gl.uniform1f(su.uMoon, s.moon); gl.uniform1f(su.uAurora, s.aurora); gl.uniform1f(su.uCloudSpeed, s.cloudSpeed); gl.uniform1f(su.uEclipse, s.eclipse || 0); gl.uniform1f(su.uGlow, s.glow === undefined ? 0.6 : s.glow);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // toon state
    const u = this.toon.u; gl.useProgram(this.toon.p); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
    gl.uniformMatrix4fv(u.uVP, false, this.vp); gl.uniform3fv(u.uCam, c.pos); gl.uniform2fv(u.uCurve, env.curve || [0, 0]);
    gl.uniform3fv(u.uLightDir, env.lightDir); gl.uniform3fv(u.uLightCol, env.lightCol); gl.uniform3fv(u.uShadowCol, env.shadowCol); gl.uniform3fv(u.uRimCol, env.rimCol);
    gl.uniform3fv(u.uFogCol, env.fogCol); gl.uniform1f(u.uFogNear, env.fogNear); gl.uniform1f(u.uFogFar, env.fogFar); gl.uniform3fv(u.uOutCol, env.outline); gl.uniform1f(u.uUnlitMul, env.unlit === undefined ? 1 : env.unlit);
    this.trans.length = 0;
  }
  draw(mesh, model, o) {
    o = o || Node._d;
    const al = o.alpha === undefined ? 1 : o.alpha;
    if ((al < 0.995 || o.additive) && !this._flush) {
      if (al <= 0.003) return;
      const dx = model[12] - this.cam.pos[0], dy = model[13] - this.cam.pos[1], dz = model[14] - this.cam.pos[2];
      this.trans.push({ mesh, m: new Float32Array(model), o: { tint: o.tint, emis: o.emis, alpha: al, unlit: o.unlit, additive: o.additive, two: o.two, flash: o.flash }, d: dx * dx + dy * dy + dz * dz }); return;
    }
    const gl = this.gl, u = this.toon.u;
    gl.bindVertexArray(mesh.vao); gl.uniformMatrix4fv(u.uModel, false, model);
    gl.uniform3fv(u.uTint, o.tint || WHITE); gl.uniform3fv(u.uEmis, o.emis || BLACK); gl.uniform1f(u.uAlpha, al); gl.uniform1f(u.uUnlit, o.unlit ? 1 : 0); gl.uniform1f(u.uFlash, o.flash || 0); gl.uniform1f(u.uOutline, 0);
    if (o.two) gl.disable(gl.CULL_FACE);
    gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
    if (o.two) gl.enable(gl.CULL_FACE);
    if (o.outline !== false && !this._flush) { gl.cullFace(gl.FRONT); gl.uniform1f(u.uOutline, o.outline || this.outlineW); gl.drawArrays(gl.TRIANGLES, 0, mesh.count); gl.cullFace(gl.BACK); }
  }
  /** Finish the frame: see-through things, particles, then bloom and grading. */
  end(particles) {
    const gl = this.gl, env = this.env;
    if (this.trans.length) {
      this.trans.sort((a, b) => b.d - a.d); this._flush = true; gl.enable(gl.BLEND); gl.depthMask(false);
      for (const t of this.trans) { gl.blendFunc(gl.SRC_ALPHA, t.o.additive ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA); this.draw(t.mesh, t.m, t.o); }
      this._flush = false; gl.depthMask(true); gl.disable(gl.BLEND);
    }
    if (particles) particles.draw(this);
    gl.bindVertexArray(this.emptyVao);
    if (!this.post) return;
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.fbMS); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.fbRes);
    gl.blitFramebuffer(0, 0, this.w, this.h, 0, 0, this.w, this.h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.viewport(0, 0, this.bw, this.bh); gl.activeTexture(gl.TEXTURE0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbA); gl.useProgram(this.pBright.p); gl.bindTexture(gl.TEXTURE_2D, this.texRes); gl.uniform1i(this.pBright.u.uTex, 0); gl.uniform1f(this.pBright.u.uThresh, env.bloomThresh || 0.7); gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.useProgram(this.pBlur.p); gl.uniform1i(this.pBlur.u.uTex, 0);
    for (let i = 0; i < 2; i++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbB); gl.bindTexture(gl.TEXTURE_2D, this.texA); gl.uniform2f(this.pBlur.u.uDir, (1 + i) / this.bw, 0); gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbA); gl.bindTexture(gl.TEXTURE_2D, this.texB); gl.uniform2f(this.pBlur.u.uDir, 0, (1 + i) / this.bh); gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, this.w, this.h);
    const u = this.pComp.u, fx = this.fx; gl.useProgram(this.pComp.p);
    gl.bindTexture(gl.TEXTURE_2D, this.texRes); gl.uniform1i(u.uScene, 0); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.texA); gl.uniform1i(u.uBloom, 1); gl.activeTexture(gl.TEXTURE0);
    gl.uniform1f(u.uBloomAmt, env.bloom === undefined ? 0.6 : env.bloom); gl.uniform1f(u.uVig, env.vig === undefined ? 0.3 : env.vig); gl.uniform1f(u.uSat, env.sat || 1); gl.uniform3fv(u.uGrade, env.grade || WHITE);
    gl.uniform1f(u.uFlash, fx.flash); gl.uniform3fv(u.uFlashCol, fx.flashCol); gl.uniform1f(u.uLines, fx.lines); gl.uniform1f(u.uTime, this.time); gl.uniform1f(u.uAberr, fx.aberr); gl.uniform1f(u.uAsp, this.w / this.h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  /** World point to CSS pixels on the canvas. */
  project(p) {
    const m = this.vp, x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
    return { x: (x / w * 0.5 + 0.5) * this.cssW, y: (1 - (y / w * 0.5 + 0.5)) * this.cssH, ok: w > 0.05 };
  }
}
Node._d = {};
E.Renderer = Renderer;

E.lerpEnv = (a, b, t) => {
  const o = {};
  for (const k in a) {
    const x = a[k], y = b[k];
    if (typeof x === 'number') o[k] = x + (y - x) * t;
    else if (Array.isArray(x)) o[k] = x.map((v, i) => v + (y[i] - v) * t);
    else if (x && typeof x === 'object') o[k] = E.lerpEnv(x, y, t);
    else o[k] = x;
  }
  if (o.lightDir) o.lightDir = E.norm(o.lightDir);
  if (o.sky && o.sky.sunDir) o.sky.sunDir = E.norm(o.sky.sunDir);
  return o;
};

// ───────────────────────── particles ─────────────────────────
class Particles {
  constructor(max = 1400) {
    const gl = E.gl; this.max = max; this.list = []; this.data = new Float32Array(max * 6 * 10);
    this.vao = gl.createVertexArray(); gl.bindVertexArray(this.vao); this.buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.buf); gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 40, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 40, 12); gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 40, 24);
    gl.bindVertexArray(null);
  }
  /** shape: 0 soft glow, 1 hard disc, 2 diamond. add: glows (additive). */
  spawn(o) {
    if (this.list.length >= this.max) return;
    this.list.push({ x: o.x, y: o.y, z: o.z, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, life: 0, max: o.life || 0.6, s0: o.s0 === undefined ? 0.2 : o.s0, s1: o.s1 === undefined ? 0 : o.s1, c: o.c || WHITE, a: o.a === undefined ? 1 : o.a, g: o.g || 0, drag: o.drag || 0, shape: o.shape || 0, add: o.add !== false });
  }
  burst(n, o, spread = 3, up = 0) { for (let i = 0; i < n; i++) { const a = Math.random() * 2 * PI, e = Math.random() * 2 - 1, r = sqrt(1 - e * e), sp = spread * (0.35 + Math.random() * 0.65); this.spawn(Object.assign({}, o, { vx: (o.vx || 0) + cos(a) * r * sp, vy: (o.vy || 0) + e * sp + up, vz: (o.vz || 0) + sin(a) * r * sp, life: (o.life || 0.6) * (0.6 + Math.random() * 0.6) })); } }
  update(dt) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i]; p.life += dt; if (p.life >= p.max) { L[i] = L[L.length - 1]; L.pop(); continue; }
      p.vy -= p.g * dt; if (p.drag) { const k = exp(-p.drag * dt); p.vx *= k; p.vy *= k; p.vz *= k; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    }
  }
  draw(R) {
    const L = this.list; if (!L.length) return;
    const gl = E.gl, d = this.data, r = R.camR, u = R.camU; let n = 0, nAdd = 0;
    const C = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]];
    for (let pass = 0; pass < 2; pass++) {
      for (const p of L) {
        if ((pass === 0) !== p.add) continue;
        const t = p.life / p.max, s = p.s0 + (p.s1 - p.s0) * t, al = p.a * (t < 0.1 ? t * 10 : 1) * (p.shape === 0 ? 1 - t * t : mn(1, (1 - t) * 4));
        for (const c of C) { d[n++] = p.x + (r[0] * c[0] + u[0] * c[1]) * s; d[n++] = p.y + (r[1] * c[0] + u[1] * c[1]) * s; d[n++] = p.z + (r[2] * c[0] + u[2] * c[1]) * s; d[n++] = c[0]; d[n++] = c[1]; d[n++] = p.shape; d[n++] = p.c[0]; d[n++] = p.c[1]; d[n++] = p.c[2]; d[n++] = al; }
      }
      if (pass === 0) nAdd = n / 10;
    }
    const pu = R.pPart.u; gl.useProgram(R.pPart.p); gl.uniformMatrix4fv(pu.uVP, false, R.vp); gl.uniform3fv(pu.uCam, R.cam.pos); gl.uniform2fv(pu.uCurve, R.env.curve || [0, 0]);
    gl.bindVertexArray(this.vao); gl.bindBuffer(gl.ARRAY_BUFFER, this.buf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, d.subarray(0, n));
    gl.enable(gl.BLEND); gl.depthMask(false); gl.disable(gl.CULL_FACE); gl.enable(gl.DEPTH_TEST);
    if (nAdd) { gl.blendFunc(gl.SRC_ALPHA, gl.ONE); gl.drawArrays(gl.TRIANGLES, 0, nAdd); }
    if (n / 10 - nAdd) { gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.drawArrays(gl.TRIANGLES, nAdd, n / 10 - nAdd); }
    gl.depthMask(true); gl.disable(gl.BLEND); gl.enable(gl.CULL_FACE); gl.useProgram(R.toon.p);
  }
}
E.Particles = Particles;

// ───────────────────────── audio (all synthesised) ─────────────────────────
E.Audio = (() => {
  let ac = null, master, sfx, musicIn, musicF, drumG, nbuf, muted = false;
  const M = { cfg: null, step: 0, next: 0, timer: null };
  const m2f = m => 440 * Math.pow(2, (m - 69) / 12);
  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    try { ac = new AC(); } catch (e) { return false; }
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4;
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.85; master.connect(comp); comp.connect(ac.destination);
    sfx = ac.createGain(); sfx.gain.value = 0.9; sfx.connect(master);
    musicF = ac.createBiquadFilter(); musicF.type = 'lowpass'; musicF.frequency.value = 9000; musicF.Q.value = 0.5;
    const mg = ac.createGain(); mg.gain.value = 0.5; musicF.connect(mg); mg.connect(master);
    musicIn = ac.createGain(); musicIn.connect(musicF); drumG = ac.createGain(); drumG.connect(musicF);
    const dl = ac.createDelay(1); dl.delayTime.value = 0.3; const fb = ac.createGain(); fb.gain.value = 0.3; const wet = ac.createGain(); wet.gain.value = 0.2;
    musicIn.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(musicF);
    nbuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }
  function tone(o, at) {
    if (!ac) return; const t = at !== undefined ? at : ac.currentTime + (o.t || 0), d = o.d || 0.2, os = ac.createOscillator(), g = ac.createGain();
    os.type = o.type || 'sine'; os.frequency.setValueAtTime(o.f, t); if (o.f2) os.frequency.exponentialRampToValueAtTime(mx(1, o.f2), t + d);
    if (o.vib) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = 5.5; lg.gain.value = o.f * 0.008; l.connect(lg); lg.connect(os.frequency); l.start(t); l.stop(t + d + 0.05); }
    const v = o.v === undefined ? 0.2 : o.v; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + (o.a || 0.006)); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    os.connect(g); g.connect(o.dest || sfx); os.start(t); os.stop(t + d + 0.06);
  }
  function noise(o, at) {
    if (!ac) return; const t = at !== undefined ? at : ac.currentTime + (o.t || 0), d = o.d || 0.2, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = nbuf; s.loop = true; f.type = o.type || 'bandpass'; f.frequency.setValueAtTime(o.f || 1000, t); if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + d); f.Q.value = o.q || 0.8;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(o.v || 0.2, t + (o.a || 0.004)); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(f); f.connect(g); g.connect(o.dest || sfx); s.start(t, Math.random() * 0.5); s.stop(t + d + 0.06);
  }
  const deg = (cfg, d, oct) => { const sc = cfg.scale, n = sc.length, k = ((d % n) + n) % n; return cfg.root + sc[k] + 12 * floor(d / n) + 12 * (oct || 0); };
  function playStep(cfg, st, t) {
    const spb = 60 / cfg.bpm / 4, bar = floor(st / 16), s = st % 16, ch = cfg.prog[bar % cfg.prog.length];
    if (s === 0 && cfg.pad !== 0) for (const k of [0, 2, 4]) { const f = m2f(deg(cfg, ch + k, 0)); tone({ f, d: spb * 16.5, type: 'triangle', v: 0.05 * (cfg.pad || 1), a: 0.3, dest: musicIn }, t); tone({ f: f * 1.005, d: spb * 16.5, type: 'sawtooth', v: 0.012 * (cfg.pad || 1), a: 0.4, dest: musicIn }, t); }
    const b = cfg.bass && cfg.bass[s]; if (b !== undefined && b !== '.' && b !== ' ') tone({ f: m2f(deg(cfg, ch + (b === '5' ? 4 : b === '8' ? 7 : 0), -2)), d: spb * 1.9, type: 'triangle', v: 0.24, dest: musicIn }, t);
    const a = cfg.arp && cfg.arp[s]; if (a !== undefined && a !== '.' && a !== ' ') tone({ f: m2f(deg(cfg, ch + [0, 2, 4, 7, 9][+a], 1)), d: spb * 1.7, type: cfg.arpType || 'triangle', v: 0.06 * (cfg.arpV || 1), dest: musicIn }, t);
    const L = cfg.lead && cfg.lead[bar % cfg.lead.length], n = L && L[s];
    if (n !== undefined && n !== null) tone({ f: m2f(deg(cfg, n, 1)), d: spb * (cfg.leadLen || 2.8), type: cfg.leadType || 'square', v: 0.05 * (cfg.leadV || 1), a: 0.012, vib: cfg.vib, dest: musicIn }, t);
    if (cfg.kick && cfg.kick[s] === 'x') tone({ f: 150, f2: 42, d: 0.17, v: 0.55, dest: drumG }, t);
    if (cfg.snare && cfg.snare[s] === 'x') { noise({ f: 1900, d: 0.13, v: 0.2, q: 0.6, dest: drumG }, t); tone({ f: 200, f2: 120, d: 0.09, v: 0.12, type: 'triangle', dest: drumG }, t); }
    if (cfg.hat && cfg.hat[s] === 'x') noise({ f: 7500, type: 'highpass', d: 0.035, v: 0.06, dest: drumG }, t);
  }
  function sched() { if (!ac || !M.cfg || ac.state !== 'running') return; if (M.next < ac.currentTime - 0.3) M.next = ac.currentTime + 0.05; while (M.next < ac.currentTime + 0.18) { playStep(M.cfg, M.step, M.next); M.next += 60 / M.cfg.bpm / 4; M.step++; } }
  return {
    init, tone, noise, m2f,
    get ready() { return !!ac; },
    music(cfg) { if (!ac) return; if (M.cfg === cfg) return; M.cfg = cfg; M.step = 0; M.next = ac.currentTime + 0.08; if (!M.timer) M.timer = setInterval(sched, 40); },
    stopMusic() { M.cfg = null; },
    color(freq, time = 0.4) { if (ac) musicF.frequency.setTargetAtTime(freq, ac.currentTime, time / 3); },
    drums(v) { if (ac) drumG.gain.setTargetAtTime(v, ac.currentTime, 0.1); },
    mute(b) { muted = b; if (ac) master.gain.setTargetAtTime(b ? 0 : 0.85, ac.currentTime, 0.03); },
    get muted() { return muted; },
    suspend() { if (ac && ac.state === 'running') ac.suspend(); }, resume() { if (ac && ac.state === 'suspended') ac.resume(); },
  };
})();

// ───────────────────────── anime character builder ─────────────────────────
E.makeHumanoid = function (o = {}) {
  const I = M4.T, G = () => new Geo(), dk = (c, f = 0.78) => [c[0] * f, c[1] * f, c[2] * f], hex = E.hex;
  const skin = o.skin || hex('#ffdcc6'), hair = o.hair || hex('#2b2d5c'), hairT = { t: E.mix3(hair, [1, 1, 1], 0.12), b: dk(hair, 0.72) };
  const top = o.top || hex('#ffffff'), acc = o.acc || hex('#ff7a3c'), bot = o.bottom || hex('#2a3566'), boots = o.boots || hex('#4a3340'), eye = o.eye || hex('#3aa0ff');
  const sleeve = o.sleeve || top, glove = o.glove || skin, shin = o.shin || boots, style = o.hairStyle || 'short';
  const h = { tails: [], q: null, blink: 2 + Math.random() * 3 };
  const root = h.root = new Node(), body = h.body = root.add(new Node()), hips = h.hips = body.add(new Node()); hips.p[1] = 0.74;
  let g = G(); g.ell(0.165, 0.11, 0.135, 10, 6, bot, I(0, -0.02, 0));
  if (o.skirt) g.cyl(0.15, 0.31, 0.27, 12, { t: o.skirt, b: dk(o.skirt, 0.82) }, I(0, -0.1, 0), false, true);
  else if (o.coat) g.cyl(0.165, 0.25, 0.22, 12, { t: o.coat, b: dk(o.coat, 0.85) }, I(0, -0.08, 0), false, true);
  if (o.pouch) g.box(0.12, 0.13, 0.08, o.pouch, I(-0.19, -0.05, 0.02));
  hips.add(new Node(g.build()));
  const torso = h.torso = hips.add(new Node());
  g = G(); g.cyl(0.2, 0.15, 0.36, 12, top, I(0, 0.2, 0)); g.ell(0.2, 0.08, 0.2, 12, 5, top, I(0, 0.38, 0)); g.cyl(0.158, 0.158, 0.06, 12, acc, I(0, 0.035, 0)); g.cyl(0.065, 0.07, 0.1, 8, skin, I(0, 0.47, 0));
  if (o.scarf) g.cyl(0.13, 0.15, 0.09, 10, o.scarf, I(0, 0.45, 0)); else g.cyl(0.09, 0.13, 0.05, 10, acc, I(0, 0.43, 0), false, false);
  if (o.stripe) g.box(0.07, 0.3, 0.02, o.stripe, I(0, 0.21, 0.19));
  const tm = torso.add(new Node(g.build())); tm.s = [1, 1, 0.76];
  // head
  const head = h.head = torso.add(new Node()); head.p = [0, 0.71, 0];
  g = G(); g.ell(0.215, 0.225, 0.21, 16, 12, skin); for (const sx of [1, -1]) g.ell(0.03, 0.045, 0.02, 6, 4, skin, I(sx * 0.212, -0.02, 0));
  head.add(new Node(g.build()));
  // hair: a cap over the top and back, then spikes
  g = G();
  const back = style === 'spiky' || style === 'short' ? -0.15 : -0.3;
  g.ell(0.24, 0.232, 0.247, 16, 12, hairT, I(0, 0.03, -0.022), (x, y, z) => y > 0.065 || (z < -0.03 && y > back));
  const spike = (len, r, x, y, z, rx, ry, rz, up) => { const m = E.at(I(x, y, z, rx, ry, rz), 0, up ? len / 2 : -len / 2, 0); if (up) g.cyl(0, r, len, 6, hairT, m, false, false); else g.cyl(r, 0, len, 6, { t: hairT.b, b: hairT.t }, m, false, false); };
  const bangs = o.bangs || [[-1.3, 0.27], [-0.78, 0.12], [-0.27, 0.075], [0.2, 0.085], [0.74, 0.12], [1.3, 0.27]];
  for (const [a, len] of bangs) spike(len, 0.07, sin(a) * 0.195, 0.115, cos(a) * 0.195 - 0.01, -0.2, a, 0, false);
  if (style === 'spiky') { for (const [x, y, z, rx, rz, len] of [[0, 0.2, 0.02, -0.5, 0, 0.2], [0.12, 0.17, -0.02, -0.2, -0.7, 0.2], [-0.12, 0.17, -0.02, -0.2, 0.7, 0.2], [0, 0.17, -0.12, 0.7, 0, 0.24], [0.15, 0.08, -0.16, 1.0, -0.8, 0.22], [-0.15, 0.08, -0.16, 1.0, 0.8, 0.22], [0, 0.02, -0.21, 1.5, 0, 0.2], [0.2, 0.05, -0.05, 0.2, -1.3, 0.16], [-0.2, 0.05, -0.05, 0.2, 1.3, 0.16]]) spike(len, 0.085, x, y + 0.03, z, rx, 0, rz, true); }
  if (o.ahoge) spike(0.17, 0.022, 0.01, 0.24, 0.02, -0.5, 0, -0.3, true);
  head.add(new Node(g.build()));
  const tail = (x, y, z, segs, r, len, baseRx, col) => { let par = head, p = [x, y, z]; for (let i = 0; i < segs; i++) { const gg = G(), r0 = r * (1 - i / segs), r1 = r * (1 - (i + 1) / segs) + 0.012; gg.ell(r0, r0, r0, 8, 5, col || hairT); gg.cyl(r0, r1, len, 8, col || hairT, I(0, -len / 2, 0), false, true); const n = par.add(new Node(gg.build())); n.p = p; h.tails.push({ n, base: i === 0 ? baseRx : 0.12, k: 0.5 + i * 0.35, i }); par = n; p = [0, -len, 0]; } };
  if (style === 'pony') tail(0, 0.13, -0.22, 3, 0.085, 0.2, 0.55);
  if (style === 'twin') { tail(0.2, 0.1, -0.08, 3, 0.07, 0.19, 0.3); tail(-0.2, 0.1, -0.08, 3, 0.07, 0.19, 0.3); }
  if (style === 'long') { const gg = G(); gg.cyl(0.2, 0.17, 0.36, 10, hairT, I(0, -0.18, 0), false, false); const n = head.add(new Node(gg.build())); n.p = [0, -0.02, -0.15]; n.s = [1, 1, 0.45]; h.tails.push({ n, base: 0.1, k: 0.35, i: 0 }); const g2 = G(); g2.cyl(0.17, 0.05, 0.3, 10, hairT, I(0, -0.15, 0), false, true); const n2 = n.add(new Node(g2.build())); n2.p = [0, -0.36, 0]; h.tails.push({ n: n2, base: 0.05, k: 0.6, i: 1 }); }
  // face (drawn flat, without ink)
  g = G(); const browC = dk(hair, 0.55), ink = hex('#2a1d2e'), eh = o.eyeH || 1;
  for (const sx of [1, -1]) {
    g.box(0.085, 0.015, 0.012, browC, I(sx * 0.09, 0.082 - (1 - eh) * 0.035, 0.19, 0, sx * 0.4, sx * -(o.brow === undefined ? 0.1 : o.brow)));
    g.box(0.11, 0.017, 0.012, ink, I(sx * 0.088, 0.055 - (1 - eh) * 0.066, 0.196, 0, sx * 0.38, sx * -(0.07 + (1 - eh) * 0.25)));
    if (!o.noBlush) g.ell(0.034, 0.016, 0.008, 8, 4, hex('#ff9d9d'), I(sx * 0.128, -0.075, 0.172, 0, sx * 0.5, 0));
  }
  g.box(o.mouth || 0.036, 0.011, 0.01, hex('#b3504e'), I(0, -0.115, 0.197));
  const face = h.face = head.add(new Node(g.build())); face.outline = false; face.unlit = true;
  g = G();
  for (const sx of [1, -1]) { const m = (z, dx = 0, dy = 0) => I(sx * 0.087 + dx, dy, z, 0, sx * 0.3, 0); g.ell(0.055, 0.07 * eh, 0.014, 10, 6, [1, 1, 1], m(0.188)); g.ell(0.041, 0.058 * eh, 0.012, 10, 6, { t: dk(eye, 0.6), b: eye }, m(0.196, 0, -0.004)); g.ell(0.021, 0.033 * eh, 0.01, 8, 5, dk(eye, 0.3), m(0.203, 0, -0.006)); g.ell(0.014, 0.016 * eh, 0.008, 6, 4, [1, 1, 1], m(0.208, 0.016, 0.026 * eh)); if (eh > 0.8) g.ell(0.007, 0.008, 0.006, 5, 3, [1, 1, 1], m(0.209, -0.014, -0.03)); }
  const eyes = h.eyes = head.add(new Node(g.build())); eyes.p = [0, -0.014, 0]; eyes.outline = false; eyes.unlit = true;
  // arms and legs
  for (const [side, sx] of [['L', 1], ['R', -1]]) {
    const arm = h['arm' + side] = torso.add(new Node()); arm.p = [sx * 0.235, 0.385, 0];
    g = G(); g.ell(0.07, 0.07, 0.07, 8, 6, sleeve); g.cyl(0.06, 0.05, 0.24, 8, sleeve, I(0, -0.125, 0)); arm.add(new Node(g.build()));
    const fore = h['fore' + side] = arm.add(new Node()); fore.p = [0, -0.25, 0];
    const fc = o.longSleeve ? sleeve : skin;
    g = G(); g.ell(0.05, 0.05, 0.05, 8, 5, fc); g.cyl(0.05, 0.043, 0.22, 8, fc, I(0, -0.11, 0)); if (o.cuff) g.cyl(0.058, 0.058, 0.06, 8, o.cuff, I(0, -0.19, 0)); g.ell(0.052, 0.058, 0.052, 8, 6, glove, I(0, -0.255, 0)); fore.add(new Node(g.build()));
    const hand = h['hand' + side] = fore.add(new Node()); hand.p = [0, -0.26, 0];
    const leg = h['leg' + side] = hips.add(new Node()); leg.p = [sx * 0.085, 0, 0];
    g = G(); g.cyl(0.078, 0.064, 0.34, 8, o.thigh || bot, I(0, -0.17, 0)); leg.add(new Node(g.build()));
    const sh = h['shin' + side] = leg.add(new Node()); sh.p = [0, -0.34, 0];
    g = G(); g.ell(0.064, 0.064, 0.064, 8, 5, shin); g.cyl(0.062, 0.052, 0.32, 8, shin, I(0, -0.16, 0)); g.box(0.11, 0.085, 0.21, boots, I(0, -0.355, 0.04)); if (o.bootTop) g.cyl(0.07, 0.07, 0.05, 8, o.bootTop, I(0, -0.04, 0)); sh.add(new Node(g.build()));
  }
  if (o.scarf) for (const sx of [1, -1]) { let par = torso, p = [sx * 0.05, 0.45, -0.1]; for (let i = 0; i < 2; i++) { const gg = G(); gg.box(0.11 - i * 0.02, 0.3, 0.022, { t: o.scarf, b: dk(o.scarf, 0.85) }, I(0, -0.15, 0)); const n = par.add(new Node(gg.build())); n.p = p; n.two = true; h.tails.push({ n, base: i === 0 ? 0.25 : 0.1, k: 0.9 + i * 0.5 + (sx > 0 ? 0 : 0.3), i, cloth: true, side: sx }); par = n; p = [0, -0.3, 0]; } }
  if (o.cape) { const gg = G(); gg.box(0.44, 0.34, 0.024, { t: o.cape, b: dk(o.cape, 0.9) }, I(0, -0.17, 0)); const n = torso.add(new Node(gg.build())); n.p = [0, 0.43, -0.14]; h.tails.push({ n, base: 0.16, k: 0.8, i: 0, cloth: true, side: 0 }); const g2 = G(); g2.box(0.5, 0.36, 0.022, { t: dk(o.cape, 0.9), b: dk(o.cape, 0.72) }, I(0, -0.18, 0)); const n2 = n.add(new Node(g2.build())); n2.p = [0, -0.34, 0]; h.tails.push({ n: n2, base: 0.08, k: 1.2, i: 1, cloth: true, side: 0 }); }
  if (o.scale) root.s = [o.scale, o.scale, o.scale];
  return h;
};

const QK = ['bodyY', 'bodyRx', 'bodyRy', 'bodyRz', 'torsoRx', 'torsoRy', 'torsoRz', 'headRx', 'headRy', 'headRz', 'aLx', 'aLy', 'aLz', 'aRx', 'aRy', 'aRz', 'fLx', 'fRx', 'lLx', 'lLz', 'lRx', 'lRz', 'sLx', 'sRx', 'tail'];
/** Pose a humanoid. a: {mode, t, cycle, phase, ninja, roll, look} */
E.animateHumanoid = function (h, dt, a) {
  const T = {}, t = a.t || 0, ph = a.cycle || 0, s = sin(ph), c = cos(ph), p = a.phase || 0, br = sin(t * 2.2 + (h.seed || 0));
  let k = 12;
  T.bodyY = br * 0.008; T.bodyRx = 0; T.bodyRy = 0; T.bodyRz = 0; T.torsoRx = 0.02 + br * 0.012; T.torsoRy = 0; T.torsoRz = 0; T.headRx = -br * 0.012; T.headRy = a.look || 0; T.headRz = 0;
  T.aLx = 0.06; T.aLy = 0; T.aLz = 0.13 + br * 0.012; T.aRx = 0.06; T.aRy = 0; T.aRz = -0.13 - br * 0.012; T.fLx = -0.18; T.fRx = -0.18;
  T.lLx = 0; T.lLz = 0.03; T.lRx = 0; T.lRz = -0.03; T.sLx = 0; T.sRx = 0; T.tail = 0.1 + br * 0.03;
  switch (a.mode) {
    case 'run': {
      const A = a.amp || 0.95;
      T.bodyY = abs(s) * 0.07 - 0.02; T.torsoRx = a.ninja ? 0.52 : 0.2; T.torsoRy = s * 0.14; T.headRx = a.ninja ? -0.38 : -0.1; T.headRy = -s * 0.06;
      T.lLx = -s * A; T.lRx = s * A; T.sLx = 0.25 + mx(0, c) * 1.2; T.sRx = 0.25 + mx(0, -c) * 1.2;
      if (a.ninja) { T.aLx = 1.2 + s * 0.08; T.aRx = 1.2 - s * 0.08; T.aLz = 0.34; T.aRz = -0.34; T.fLx = -0.08; T.fRx = -0.08; }
      else { T.aLx = s * 0.9; T.aRx = -s * 0.9; T.aLz = 0.15; T.aRz = -0.15; T.fLx = -1.1; T.fRx = -1.1; }
      T.tail = 1.1 + sin(t * 11) * 0.12; k = 24; break;
    }
    case 'jump': T.lLx = -1.05; T.sLx = 1.6; T.lRx = -0.25; T.sRx = 1.1; T.aLx = -0.5; T.aRx = 0.9; T.aLz = 0.5; T.aRz = -0.4; T.fLx = -0.6; T.fRx = -0.3; T.torsoRx = 0.22; T.headRx = -0.15; T.tail = 0.7; k = 20; break;
    case 'fall': T.lLx = -0.35; T.sLx = 0.5; T.lRx = 0.3; T.sRx = 0.7; T.aLz = 1.3; T.aRz = -1.3; T.aLx = -0.2; T.aRx = -0.2; T.torsoRx = 0.1; T.tail = -0.4; k = 14; break;
    case 'slide': T.bodyY = -0.1; T.bodyRx = -1.08; T.lLx = -0.42; T.lRx = -0.05; T.sLx = 0.05; T.sRx = 0.75; T.aLx = 0.5; T.aRx = 0.8; T.aLz = 0.5; T.aRz = -0.5; T.headRx = 0.75; T.torsoRx = 0.3; T.tail = 1.5; k = 26; break;
    case 'atk1': { const e = E.ease(mn(1, p * 1.6)); T.torsoRy = E.lerp(-0.75, 0.8, e); T.aRx = -1.45; T.aRy = E.lerp(-1.2, 1.25, e); T.aRz = -0.15; T.fRx = -0.15; T.aLx = 0.5; T.aLz = 0.5; T.fLx = -0.9; T.lLx = -0.45; T.sLx = 0.5; T.lRx = 0.4; T.sRx = 0.3; T.torsoRx = 0.18; T.bodyY = -0.05; k = 40; break; }
    case 'atk2': { const e = E.ease(mn(1, p * 1.6)); T.torsoRy = E.lerp(0.8, -0.8, e); T.aRx = -1.3; T.aRy = E.lerp(1.25, -1.3, e); T.aRz = -0.1; T.fRx = -0.1; T.aLx = 0.4; T.aLz = 0.6; T.fLx = -0.8; T.lLx = 0.4; T.sLx = 0.3; T.lRx = -0.5; T.sRx = 0.5; T.torsoRx = 0.2; T.bodyY = -0.05; k = 40; break; }
    case 'atk3': { const e = E.ease(mn(1, p * 1.5)); T.aRx = E.lerp(-3.1, -0.5, e); T.aLx = E.lerp(-3.0, -0.5, e); T.aRz = 0.25; T.aLz = -0.25; T.fRx = -0.25; T.fLx = -0.25; T.torsoRx = E.lerp(-0.3, 0.55, e); T.bodyY = sin(mn(1, p * 1.4) * PI) * 0.35 - 0.04 * e; T.lLx = -0.5 * (1 - e) - 0.5 * e; T.sLx = 0.9; T.lRx = 0.3; T.sRx = 0.6; k = 40; break; }
    case 'cast': { T.aLx = -1.9; T.aRx = -1.9; T.aLz = 0.35; T.aRz = -0.35; T.fLx = -0.5; T.fRx = -0.5; T.torsoRx = -0.12; T.headRx = -0.2; T.bodyY = 0.06 + sin(t * 9) * 0.01; T.lLx = -0.2; T.sLx = 0.4; T.lRx = 0.15; T.tail = 0.7; k = 18; break; }
    case 'dodge': T.bodyY = -0.25; T.torsoRx = 0.9; T.lLx = -1.4; T.lRx = -1.2; T.sLx = 1.9; T.sRx = 1.9; T.aLx = -0.8; T.aRx = -0.8; T.fLx = -1.6; T.fRx = -1.6; T.headRx = 0.5; k = 30; break;
    case 'hit': T.torsoRx = -0.4; T.headRx = -0.35; T.aLz = 0.7; T.aRz = -0.7; T.aLx = -0.4; T.aRx = -0.4; T.lLx = -0.3; T.sLx = 0.3; T.bodyY = -0.03; k = 30; break;
    case 'dead': T.bodyRx = -1.5; T.bodyY = 0.12; T.aLz = 1.2; T.aRz = -1.2; T.lLz = 0.25; T.lRz = -0.25; T.headRx = -0.2; k = 6; break;
    case 'talk': { const w = sin(t * 3.1); T.aRx = -0.9 + w * 0.12; T.fRx = -1.3; T.aRz = -0.25; T.headRz = w * 0.05; T.torsoRy = 0.08; break; }
    case 'guard': T.aLx = -1.2; T.aRx = -1.2; T.fLx = -1.5; T.fRx = -1.5; T.aLz = -0.3; T.aRz = 0.3; T.torsoRx = 0.15; T.lLx = -0.3; T.sLx = 0.4; T.lRx = 0.3; T.sRx = 0.2; T.bodyY = -0.06; k = 22; break;
    case 'proud': T.aLz = 0.75; T.aRz = -0.75; T.fLx = -2.0; T.fRx = -2.0; T.aLx = 0.25; T.aRx = 0.25; T.torsoRx = -0.08; T.headRx = -0.12; break;
    case 'kneel': T.bodyY = -0.34; T.lLx = -1.5; T.sLx = 1.6; T.lRx = 0.1; T.sRx = 1.5; T.torsoRx = 0.35; T.headRx = 0.35; T.aLx = -0.3; T.aRx = -0.3; k = 8; break;
  }
  if (a.over) Object.assign(T, a.over);
  const q = h.q || (h.q = Object.assign({}, T)), f = 1 - exp(-k * dt);
  for (const key of QK) q[key] += (T[key] - q[key]) * f;
  h.body.p[1] = q.bodyY; h.body.r[0] = q.bodyRx + (a.roll || 0); h.body.r[1] = q.bodyRy; h.body.r[2] = q.bodyRz;
  h.torso.r[0] = q.torsoRx; h.torso.r[1] = q.torsoRy; h.torso.r[2] = q.torsoRz; h.head.r[0] = q.headRx; h.head.r[1] = q.headRy; h.head.r[2] = q.headRz;
  h.armL.r[0] = q.aLx; h.armL.r[1] = q.aLy; h.armL.r[2] = q.aLz; h.armR.r[0] = q.aRx; h.armR.r[1] = q.aRy; h.armR.r[2] = q.aRz; h.foreL.r[0] = q.fLx; h.foreR.r[0] = q.fRx;
  h.legL.r[0] = q.lLx; h.legL.r[2] = q.lLz; h.legR.r[0] = q.lRx; h.legR.r[2] = q.lRz; h.shinL.r[0] = q.sLx; h.shinR.r[0] = q.sRx;
  for (const tl of h.tails) { const w = sin(t * (tl.cloth ? 9 : 6) + tl.i * 1.3 + (tl.side || 0)) * (0.05 + 0.1 * mn(1, abs(q.tail))); tl.n.r[0] = tl.base + q.tail * tl.k * (tl.i === 0 ? 1 : 0.35) + w - (tl.i === 0 ? q.torsoRx * 0.6 : 0); tl.n.r[2] = sin(t * 5 + tl.i) * 0.04 + (tl.side || 0) * 0.12; }
  h.blink -= dt; if (h.blink < -0.11) h.blink = 1.8 + Math.random() * 3.5;
  h.eyes.s[1] = a.eyesShut ? 0.08 : (h.blink < 0 ? 0.1 : 1);
};

/** Dark soft disc for a ground shadow. */
E.shadowMesh = () => { const g = new Geo(); g.cyl(1, 1, 0.001, 20, [0, 0, 0], null, true, false); return g.build(); };

E.loop = fn => { let last = performance.now(); const step = now => { const dt = mn(0.05, (now - last) / 1000); last = now; fn(dt); requestAnimationFrame(step); }; requestAnimationFrame(step); };
})();
