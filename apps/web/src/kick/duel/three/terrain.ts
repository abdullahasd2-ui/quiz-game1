// The land itself: one height function shared by everything that stands on it, the ground mesh painted by slope,
// height and wetness (grass, earth, rock, wet mud by the water, caustics under it), carved moats and pools, and the
// mountain ranges in layers behind. Plus the rock generator used for boulders and cliffs.
import * as THREE from 'three';

// ── Noise ───────────────────────────────────────────────────────────────────

function hash(x: number, y: number) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
/** Smooth value noise in [0, 1]. */
export function noise2(x: number, y: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x: number, y: number, oct = 5) {
  let s = 0;
  let a = 0.5;
  let f = 1;
  for (let i = 0; i < oct; i++) {
    s += noise2(x * f + i * 17.3, y * f - i * 9.1) * a;
    f *= 2.03;
    a *= 0.5;
  }
  return s / (1 - Math.pow(0.5, oct));
}
/** Ridged noise: sharp crests, like eroded mountain spines. */
export function ridged(x: number, y: number, oct = 6) {
  let s = 0;
  let a = 0.5;
  let f = 1;
  let w = 1;
  for (let i = 0; i < oct; i++) {
    let n = 1 - Math.abs(noise2(x * f + i * 31.7, y * f + i * 7.3) * 2 - 1);
    n *= n * w;
    w = Math.min(1, n * 2);
    s += n * a;
    f *= 2.1;
    a *= 0.5;
  }
  return s;
}
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ── The layout the land is carved for ───────────────────────────────────────

export const CASTLE_X = 10.5;
/** Water levels. */
export const MOAT_Y = -0.14;
export const POOL_Y = 0.02;
export const FALLS = { x: -9, z: -46 };
export const FALLS_POOL = { x: -9, z: -45, r: 5.4 };
export const LIGHTHOUSE = { x: 12, z: -80 };
export const MOAT = { inner: 6.45, outer: 8.2 };
const POOL = { x0: -1.1, x1: 1.1, z0: -4.05, z1: 6.85 };

/** Ground height at (x, z): flat where things are built, carved where water lies, rolling and noisy further out. */
export function heightAt(x: number, z: number) {
  const d = Math.hypot(x, z);
  const far = smooth(18, 48, d);
  let h = (Math.sin(x * 0.08) * Math.cos(-z * 0.07) * 2.2 + Math.sin(x * 0.21 - z * 0.13) * 0.8) * far - Math.max(0, d - 26) * 0.04;
  // Small undulations everywhere except the built-up middle: no billiard-table ground.
  const built = Math.max(1 - smooth(5.5, 7.5, Math.abs(x)) * 1, 0) * (1 - smooth(14, 17, z)) * smooth(-9, -6, z);
  let near = 1 - built;
  for (const cx of [-CASTLE_X, CASTLE_X]) near = Math.min(near, smooth(8.6, 11.5, Math.hypot(x - cx, z)));
  h += (fbm(x * 0.09, z * 0.09, 4) - 0.5) * 1.4 * near * (0.35 + far) + (fbm(x * 0.6, z * 0.6, 2) - 0.5) * 0.12 * near;
  // Gentle knolls round the edges of the garden.
  h += Math.max(0, fbm(x * 0.05 + 3, z * 0.05) - 0.55) * 6 * far;
  // Moats: a steep stone-lined inner edge, a natural sloping outer bank.
  for (const cx of [-CASTLE_X, CASTLE_X]) {
    const r = Math.hypot(x - cx, z);
    const dip = smooth(MOAT.inner - 0.12, MOAT.inner + 0.25, r) * (1 - smooth(MOAT.outer - 0.6, MOAT.outer + 0.35, r));
    h = h * (1 - dip) - 0.78 * dip;
  }
  // The formal pool (its stone rims hide the edge).
  if (x > POOL.x0 && x < POOL.x1 && z > POOL.z0 && z < POOL.z1) h = -0.42;
  // The waterfall's plunge pool.
  const rp = Math.hypot(x - FALLS_POOL.x, z - FALLS_POOL.z);
  const pd = 1 - smooth(FALLS_POOL.r - 1.6, FALLS_POOL.r + 0.4, rp);
  h = h * (1 - pd) + (heightAt0(FALLS_POOL.x, FALLS_POOL.z) - 1.1) * pd;
  return h;
}
function heightAt0(x: number, z: number) {
  const d = Math.hypot(x, z);
  const far = smooth(18, 48, d);
  return (Math.sin(x * 0.08) * Math.cos(-z * 0.07) * 2.2 + Math.sin(x * 0.21 - z * 0.13) * 0.8) * far - Math.max(0, d - 26) * 0.04;
}
/** The plunge pool's surface height. */
export const fallsPoolY = () => heightAt0(FALLS_POOL.x, FALLS_POOL.z) - 0.35;

// ── Ground ──────────────────────────────────────────────────────────────────

/** Patches a standard material with the water caustics: rippling light on whatever lies under the water level. */
export function withCaustics(mat: THREE.MeshStandardMaterial, time: { value: number }, key: string) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = time;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec3 vWp;\nfloat cz(vec2 p, float t){ vec2 q = p; float c = 0.; for (int i = 0; i < 3; i++) { q += vec2(sin(q.y * 1.7 + t), cos(q.x * 1.9 - t * 0.8)); c += 1. / (1. + 6. * abs(sin(q.x + q.y))); } return c / 3.; }')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float under = smoothstep(${(MOAT_Y + 0.02).toFixed(2)}, ${(MOAT_Y - 0.25).toFixed(2)}, vWp.y);
        if (under > 0.) {
          float c = pow(cz(vWp.xz * 2.2, uTime * 0.9), 3.) * 1.6;
          totalEmissiveRadiance += vec3(0.35, 0.5, 0.85) * c * under * 0.35;
          diffuseColor.rgb *= mix(1., 0.55, under);
        }`,
      );
  };
  mat.customProgramCacheKey = () => `caustic-${key}`;
  return mat;
}

/** The ground mesh: vertex colours painted from slope, height, wetness and noise, on top of the grass texture. */
export function buildGround(map: THREE.Texture, time: { value: number }, hi: boolean) {
  const n = hi ? 220 : 110;
  const geo = new THREE.PlaneGeometry(300, 300, n, n);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  const nrm = geo.attributes.normal as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  const grass = new THREE.Color('#a8c9b4');
  const grass2 = new THREE.Color('#c2cc9c');
  const earth = new THREE.Color('#a8919a');
  const rock = new THREE.Color('#d0cce0');
  const mud = new THREE.Color('#5a4a52');
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const slope = 1 - nrm.getY(i);
    const nz = fbm(x * 0.12, z * 0.12, 3);
    c.copy(grass).lerp(grass2, smooth(0.45, 0.7, nz));
    c.lerp(earth, smooth(0.62, 0.8, fbm(x * 0.07 + 40, z * 0.07, 3)) * 0.8);
    c.lerp(rock, smooth(0.08, 0.3, slope));
    // Wet and dark at the water's edge, and below it.
    c.lerp(mud, smooth(MOAT_Y + 0.35, MOAT_Y - 0.05, y) * 0.9);
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = withCaustics(new THREE.MeshStandardMaterial({ map, vertexColors: true, roughness: 0.97 }), time, 'ground');
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

/** Mountain ranges in three layers, ridged and eroded, coloured from forest to bare rock to snow; fog does the rest. */
export function buildMountains(hi: boolean) {
  const group = new THREE.Group();
  const layers = [
    { r0: 62, r1: 105, h: 26, f: 0.022, col: ['#24303a', '#4d4b66', '#9fa3c4'], seed: 1 },
    { r0: 100, r1: 150, h: 46, f: 0.016, col: ['#26294a', '#4a4570', '#c9cbe6'], seed: 2 },
    { r0: 140, r1: 190, h: 62, f: 0.011, col: ['#2a2654', '#3f3a6e', '#d8d6f0'], seed: 3 },
  ];
  for (const L of layers) {
    const na = hi ? 200 : 110;
    const nr = hi ? 34 : 18;
    const verts: number[] = [];
    const cols: number[] = [];
    const idx: number[] = [];
    const a0 = Math.PI * 1.03;
    const a1 = Math.PI * 1.97;
    const lo = new THREE.Color(L.col[0]);
    const mid = new THREE.Color(L.col[1]);
    const snow = new THREE.Color(L.col[2]);
    const c = new THREE.Color();
    for (let j = 0; j <= nr; j++) {
      for (let i = 0; i <= na; i++) {
        const a = a0 + ((a1 - a0) * i) / na;
        const t = j / nr;
        const r = L.r0 + (L.r1 - L.r0) * t;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r * 0.9;
        // Rise toward the middle of the band, fall at both edges; ridged crests on top.
        const env = Math.sin(t * Math.PI) ** 0.8;
        const rr = ridged(x * L.f + L.seed * 13, z * L.f + L.seed * 7);
        const y = -4 + env * L.h * (0.25 + rr * 0.95) + (fbm(x * L.f * 4, z * L.f * 4, 3) - 0.5) * 3 * env;
        verts.push(x, y, z);
        const k = y / L.h;
        c.copy(lo).lerp(mid, smooth(0.18, 0.45, k)).lerp(snow, smooth(0.62, 0.8, k + (noise2(x * 0.2, z * 0.2) - 0.5) * 0.15));
        cols.push(c.r, c.g, c.b);
      }
    }
    for (let j = 0; j < nr; j++)
      for (let i = 0; i < na; i++) {
        const p = j * (na + 1) + i;
        idx.push(p, p + na + 1, p + 1, p + 1, p + na + 1, p + na + 2);
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: L.seed === 1 }));
    m.position.z = -12;
    group.add(m);
  }
  return group;
}

// ── Rocks ───────────────────────────────────────────────────────────────────

/** A boulder: an icosphere pushed by layered noise, flattened at the base, with lichen and dark crevices painted in. */
export function rockGeometry(seed: number, detail = 3, stratified = false) {
  const geo = new THREE.IcosahedronGeometry(1, detail);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = fbm(v.x * 1.3 + seed * 5 + v.y * 0.7, v.z * 1.3 + v.y * 1.1 - seed * 3, 4);
    let r = 0.72 + n * 0.55;
    // Layered strata for cliffs: terraces along y.
    if (stratified) r += Math.round(v.y * 4 + n) * 0.03 + Math.sin(v.y * 11 + n * 4) * 0.035;
    v.multiplyScalar(r);
    if (v.y < -0.35) v.y = -0.35 + (v.y + 0.35) * 0.3;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const nrm = geo.attributes.normal as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  const base = new THREE.Color('#8e8aa3');
  const dark = new THREE.Color('#3d3a4c');
  const lichen = new THREE.Color('#7f9a6a');
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const r = v.length();
    c.copy(base).lerp(dark, smooth(0.95, 0.7, r));
    // Moss and lichen on the upward faces.
    c.lerp(lichen, smooth(0.55, 0.9, nrm.getY(i)) * smooth(0.45, 0.65, noise2(v.x * 3 + seed, v.z * 3)) * 0.8);
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}
