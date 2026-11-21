// The world around the two castles: an Andalusian night garden between two fortresses.
//   Each castle sits in its own moat, crossed by its drawbridge onto a stone landing; cobbled roads lined with
//   lanterns lead to a plaza with a tiered fountain, and from it a long reflecting pool runs between rows of cypresses
//   and palms. Around: pines and oaks that sway in the wind, rocks, grass and night flowers; behind: a waterfall off a
//   cliff into a pool, a hill village with lit windows, and a lighthouse whose beam sweeps the sky.
//   Life: wind gusts, rippling water with the moon's glitter, drifting clouds and low mist, fireflies, birds round the
//   lighthouse, the odd shooting star.
// Everything is drawn from code (no image files), instanced where it repeats, and thinned out on the low tier.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { cobbleTexture, groundTexture } from './textures';
import { Particles, softTexture } from './particles';

export type Tier = 'high' | 'low';
type Place = { x: number; z: number; rot: number };

/** Ground height: flat where the castles stand, rolling further out (the ground mesh uses the same function). */
export function heightAt(x: number, z: number) {
  const d = Math.hypot(x, z);
  const flat = Math.min(1, Math.max(0, (d - 18) / 30));
  return (Math.sin(x * 0.08) * Math.cos(-z * 0.07) * 2.2 + Math.sin(x * 0.21 - z * 0.13) * 0.8) * flat - Math.max(0, d - 26) * 0.04;
}

function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

// ── Shared shader pieces ────────────────────────────────────────────────────

/** Bends a material's vertices in the wind; the higher above its base, the more. Works with instancing. */
function sway(mat: THREE.Material, amp: number, time: { value: number }, key: string) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = time;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;').replace(
      '#include <begin_vertex>',
      /* glsl */ `#include <begin_vertex>
      vec3 wo = vec3(0.);
      #ifdef USE_INSTANCING
        wo = (instanceMatrix * vec4(0., 0., 0., 1.)).xyz;
      #endif
      float hh = max(0., position.y);
      float ph = uTime * 1.25 + wo.x * 0.37 + wo.z * 0.23;
      float gust = 0.55 + 0.45 * sin(uTime * 0.33 + wo.x * 0.04 + wo.z * 0.02);
      transformed.x += (sin(ph) + 0.35 * sin(ph * 2.7 + 1.3)) * hh * hh * ${amp.toFixed(5)} * gust;
      transformed.z += cos(ph * 0.83) * hh * hh * ${(amp * 0.5).toFixed(5)} * gust;`,
    );
  };
  mat.customProgramCacheKey = () => `sway-${key}`;
  return mat;
}

const WATER_VERT = /* glsl */ `
  #include <fog_pars_vertex>
  varying vec3 vW;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.);
    vW = w.xyz;
    vec4 mvPosition = viewMatrix * w;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;
const WATER_FRAG = /* glsl */ `
  uniform float uTime; uniform vec3 uDeep; uniform vec3 uSky; uniform vec3 uGlow; uniform float uOpacity;
  varying vec3 vW;
  #include <fog_pars_fragment>
  void main() {
    vec2 p = vW.xz; float t = uTime;
    vec2 g = vec2(
      cos(p.x * 1.7 + t * 1.1) + 0.6 * cos(p.x * 0.9 + p.y * 1.3 - t * 0.8) + 0.25 * cos((p.x + p.y) * 3.1 + t * 2.0),
      cos(p.y * 1.9 - t * 0.9) + 0.6 * cos(p.y * 0.7 - p.x * 1.1 + t * 0.7) + 0.25 * cos((p.x - p.y) * 2.7 - t * 1.7));
    vec3 N = normalize(vec3(g.x * 0.07, 1., g.y * 0.07));
    vec3 V = normalize(cameraPosition - vW);
    float fres = pow(1. - max(dot(N, V), 0.), 3.);
    vec3 col = mix(uDeep, uSky, 0.12 + fres * 0.5);
    vec3 L = normalize(vec3(-0.2, 0.33, -1.));
    vec3 R = reflect(-V, N);
    float spec = pow(max(dot(R, L), 0.), 220.) * 3.0 + pow(max(dot(R, L), 0.), 30.) * 0.15;
    col += vec3(1., 0.93, 0.8) * spec + uGlow * (0.06 + fres * 0.12);
    gl_FragColor = vec4(col, uOpacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }`;

function water(time: { value: number }, glow = '#2b2a6a', opacity = 0.93) {
  return new THREE.ShaderMaterial({
    vertexShader: WATER_VERT,
    fragmentShader: WATER_FRAG,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: time, uDeep: { value: new THREE.Color('#070b22') }, uSky: { value: new THREE.Color('#352d6e') }, uGlow: { value: new THREE.Color(glow) }, uOpacity: { value: opacity } }]),
    transparent: opacity < 1,
    fog: true,
  });
}
// UniformsUtils.merge clones the uniforms: give the shared clock back.
function shareTime(m: THREE.ShaderMaterial, time: { value: number }) {
  m.uniforms.uTime = time;
  return m;
}

// ── Geometry kits ───────────────────────────────────────────────────────────

function jitter(geo: THREE.BufferGeometry, amount: number, seed: number) {
  const rnd = seeded(seed);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  // Same position → same offset, so faces stay closed.
  const seen = new Map<string, [number, number, number]>();
  for (let i = 0; i < pos.count; i++) {
    const k = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    const o = seen.get(k) ?? [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5];
    seen.set(k, o);
    pos.setXYZ(i, pos.getX(i) + o[0] * amount, pos.getY(i) + o[1] * amount, pos.getZ(i) + o[2] * amount);
  }
  geo.computeVertexNormals();
  return geo;
}

function pineGeo() {
  const parts = [
    [1.5, 2.3, 1.9],
    [1.15, 2.0, 2.9],
    [0.8, 1.7, 3.8],
    [0.45, 1.2, 4.55],
  ].map(([r, h, y], i) => jitter(new THREE.ConeGeometry(r!, h!, 8, 2).translate(0, y!, 0), 0.22, 3 + i));
  return mergeGeometries(parts.map((g) => g.toNonIndexed()))!;
}
function oakGeo() {
  const rnd = seeded(41);
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    const r = 0.8 + rnd() * 0.6;
    parts.push(jitter(new THREE.IcosahedronGeometry(r, 1), 0.3, 50 + i).translate((rnd() - 0.5) * 1.6, 2.6 + rnd() * 1.3, (rnd() - 0.5) * 1.6).toNonIndexed());
  }
  return mergeGeometries(parts)!;
}
function trunkGeo(h: number, r: number, branches: boolean) {
  const parts = [new THREE.CylinderGeometry(r * 0.7, r, h, 7).translate(0, h / 2, 0).toNonIndexed()];
  if (branches) {
    for (const [a, l] of [
      [0.7, 1.2],
      [-0.9, 1.0],
    ] as const) {
      const b = new THREE.CylinderGeometry(r * 0.3, r * 0.5, l, 5).translate(0, l / 2, 0);
      b.rotateZ(a);
      b.translate(0, h * 0.7, 0);
      parts.push(b.toNonIndexed());
    }
  }
  return mergeGeometries(parts)!;
}
function cypressGeo() {
  return jitter(new THREE.SphereGeometry(0.62, 9, 12).scale(1, 3.4, 1).translate(0, 2.7, 0), 0.12, 77);
}
/** A palm: a leaning ringed trunk and a crown of drooping fronds (fronds returned apart, so they alone sway). */
function palmGeo() {
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.25, 1.6, 0), new THREE.Vector3(0.75, 3.2, 0), new THREE.Vector3(1.3, 4.6, 0)]);
  const trunk = new THREE.TubeGeometry(curve, 24, 0.16, 7, false);
  // Rings on the trunk: each segment swells a little at its top.
  const pos = trunk.attributes.position as THREE.BufferAttribute;
  const uv = trunk.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const u = uv.getX(i);
    const c = curve.getPointAt(u);
    const swell = 1 + 0.18 * Math.pow((u * 14) % 1, 3) - u * 0.25;
    pos.setXYZ(i, c.x + (pos.getX(i) - c.x) * swell, c.y + (pos.getY(i) - c.y) * swell, c.z + (pos.getZ(i) - c.z) * swell);
  }
  trunk.computeVertexNormals();
  const top = curve.getPointAt(1);
  const coconuts = [0, 2.1, 4.2].map((a) => new THREE.SphereGeometry(0.13, 7, 5).translate(top.x + Math.cos(a) * 0.18, top.y - 0.15, Math.sin(a) * 0.18).toNonIndexed());
  const fronds: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 11; k++) {
    const g = new THREE.PlaneGeometry(0.55, 2.6, 2, 10);
    const p = g.attributes.position as THREE.BufferAttribute;
    const lift = k % 2 ? 0.75 : 0.35;
    for (let i = 0; i < p.count; i++) {
      const l = p.getY(i) + 1.3; // 0 … 2.6 along the frond
      const s = l / 2.6;
      const th = lift - s * 1.7; // rises, then droops
      const w = p.getX(i) * (1 - s * 0.75) * (1 + Math.sin(s * Math.PI) * 0.4);
      p.setXYZ(i, w, Math.sin(th) * l * 0.85, Math.cos(th) * l * 0.9 + Math.abs(w) * 0.25);
    }
    g.rotateY((k / 11) * Math.PI * 2 + (k % 3) * 0.2);
    g.translate(top.x, top.y, top.z);
    fronds.push(g.toNonIndexed());
  }
  return { trunk: mergeGeometries([trunk.toNonIndexed(), ...coconuts])!, fronds: mergeGeometries(fronds)! };
}
function grassGeo() {
  const parts: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 5; k++) {
    const h = 0.32 + (k % 3) * 0.1;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.035, 0, 0, 0.035, 0, 0, 0.02 * (k - 2), h, 0.05], 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute([0.1, 0.18, 0.15, 0.1, 0.18, 0.15, 0.42, 0.62, 0.45], 3));
    g.rotateY((k / 5) * Math.PI);
    g.translate((k - 2) * 0.05, 0, ((k * 7) % 5) * 0.03 - 0.06);
    parts.push(g);
  }
  const m = mergeGeometries(parts)!;
  m.computeVertexNormals();
  return m;
}

// ── The world ───────────────────────────────────────────────────────────────

export class World {
  readonly group = new THREE.Group();
  readonly spray: Particles;
  readonly mist: Particles;
  private readonly time = { value: 0 };
  private readonly lanternGlows: { s: THREE.Sprite; base: number; ph: number }[] = [];
  private readonly lanternMat: THREE.MeshStandardMaterial;
  private readonly flowerMat: THREE.MeshStandardMaterial;
  private readonly runeMat: THREE.MeshStandardMaterial;
  private readonly clouds: { s: THREE.Sprite; v: number }[] = [];
  private readonly fireflies: THREE.Points;
  private readonly flyBase: Float32Array;
  private readonly beam: THREE.Group;
  private readonly beamLamp: THREE.MeshBasicMaterial;
  private readonly birds: { g: THREE.Group; wings: [THREE.Mesh, THREE.Mesh]; r: number; h: number; sp: number; ph: number }[] = [];
  private readonly star: THREE.Sprite;
  private starT = 6;
  private starV = new THREE.Vector3();
  private readonly lights: { l: THREE.PointLight; base: number }[] = [];
  private readonly fountainTop = new THREE.Vector3();
  private readonly fallsBase = new THREE.Vector3();
  private readonly tier: Tier;
  private readonly paths: THREE.Vector3[][] = [];

  constructor(castles: { position: THREE.Vector3; rotY: number }[], tier: Tier) {
    this.tier = tier;
    const hi = tier === 'high';
    const g = this.group;
    const time = this.time;
    const rnd = seeded(2027);
    const glowTex = softTexture(0.05);

    const local = (c: (typeof castles)[number], x: number, z: number) => new THREE.Vector3(x, 0, z).applyAxisAngle(new THREE.Vector3(0, 1, 0), c.rotY).add(c.position);

    // ── Ground ──
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300, hi ? 120 : 70, hi ? 120 : 70), new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 1, color: '#bfc3e8' }));
    ground.rotation.x = -Math.PI / 2;
    const gp = ground.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < gp.count; i++) gp.setZ(i, heightAt(gp.getX(i), -gp.getY(i)));
    ground.geometry.computeVertexNormals();
    ground.receiveShadow = true;
    g.add(ground);

    // ── Materials ──
    const stone = new THREE.MeshStandardMaterial({ color: '#77748f', roughness: 0.95, flatShading: true });
    const stoneLight = new THREE.MeshStandardMaterial({ color: '#8e8aa6', roughness: 0.85 });
    const iron = new THREE.MeshStandardMaterial({ color: '#2d2c36', metalness: 0.7, roughness: 0.45 });
    const gold = new THREE.MeshStandardMaterial({ color: '#e8b64c', metalness: 0.9, roughness: 0.3, emissive: '#3a2200', emissiveIntensity: 0.4 });
    const cob = cobbleTexture([1, 1]);
    const road = new THREE.MeshStandardMaterial({ map: cob.map, bumpMap: cob.bump, bumpScale: 0.8, roughness: 0.9, color: '#b4b0cc' });
    this.lanternMat = new THREE.MeshStandardMaterial({ color: '#2a1a08', emissive: '#ffb35c', emissiveIntensity: 2.2 });
    const curbMat = new THREE.MeshStandardMaterial({ color: '#5a5770', roughness: 0.95 });
    const moatWater = shareTime(water(time, '#2b2a6a'), time);

    // ── Moats, landings and the roads ──
    const rockGeo = jitter(new THREE.IcosahedronGeometry(1, 1), 0.45, 9);
    const rocks: THREE.Matrix4[] = [];
    const rock = (x: number, z: number, s: number, flat = 0.6) => rocks.push(new THREE.Matrix4().compose(new THREE.Vector3(x, heightAt(x, z) + s * 0.15, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, rnd() * 3)), new THREE.Vector3(s, s * flat, s * (0.8 + rnd() * 0.4))));
    const plaza = new THREE.Vector3(0, 0, 10.5);
    for (const c of castles) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(6.6, 8.0, hi ? 96 : 48, 1), moatWater);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(c.position.x, 0.08, c.position.z);
      g.add(ring);
      // The moat's dark bed below the water, and stone curbs on both banks.
      const bed = new THREE.Mesh(new THREE.RingGeometry(6.5, 8.1, hi ? 96 : 48, 1), new THREE.MeshBasicMaterial({ color: '#05040c' }));
      bed.rotation.x = -Math.PI / 2;
      bed.position.set(c.position.x, 0.03, c.position.z);
      g.add(bed);
      for (const r of [6.55, 8.05]) {
        const curb = new THREE.Mesh(new THREE.TorusGeometry(r, 0.11, 5, hi ? 96 : 48), curbMat);
        curb.rotation.x = Math.PI / 2;
        curb.scale.z = 0.7;
        curb.position.set(c.position.x, 0.12, c.position.z);
        curb.receiveShadow = true;
        g.add(curb);
      }
      // The landing where the drawbridge comes down, and steps down to the road.
      const land = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 1.3), stoneLight);
      const lp = local(c, 0, 8.85);
      land.position.set(lp.x, 0.25, lp.z);
      land.rotation.y = c.rotY;
      land.castShadow = land.receiveShadow = true;
      g.add(land);
      for (const [k, sx] of [-1.15, 1.15].entries()) {
        // Two short pillars with gold caps flank the landing.
        const pp = local(c, sx, 9.2);
        const pil = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.3, 0.34), stoneLight);
        pil.position.set(pp.x, 0.65, pp.z);
        pil.rotation.y = c.rotY;
        pil.castShadow = true;
        g.add(pil);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), gold);
        cap.position.set(pp.x, 1.42, pp.z);
        g.add(cap);
        if (k === 0 && hi) this.addLight(new THREE.Vector3(lp.x, 1.6, lp.z + 0.6));
      }
      // A road from the landing to the plaza.
      const start = local(c, 0, 9.5);
      const side = Math.sign(c.position.x);
      const mid = new THREE.Vector3(side * 3.6, 0, 10.6);
      const pts = [start, local(c, 0, 11.2), mid, new THREE.Vector3(side * 2.4, 0, 10.5)];
      this.road(new THREE.CatmullRomCurve3(pts), 1.7, road);
      // Rocks along the moat's outer bank, away from the landing.
      for (let i = 0; i < (hi ? 16 : 8); i++) {
        const a = rnd() * Math.PI * 2;
        const front = Math.abs(((a - Math.PI / 2 + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.5;
        if (front) continue;
        const rr = 8.5 + rnd() * 1.4;
        const lp2 = local(c, Math.cos(a) * rr, Math.sin(a) * rr);
        rock(lp2.x, lp2.z, 0.25 + rnd() * 0.5);
      }
    }
    // The road toward the viewer.
    this.road(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 13.2), new THREE.Vector3(0.4, 0, 18), new THREE.Vector3(-0.6, 0, 24), new THREE.Vector3(0.5, 0, 34)]), 1.9, road);

    // ── The plaza and its fountain ──
    const plazaMat = road.clone();
    plazaMat.map = cobbleTexture([4, 4]).map;
    const pl = new THREE.Mesh(new THREE.CircleGeometry(3.4, 48), plazaMat);
    pl.rotation.x = -Math.PI / 2;
    pl.position.set(plaza.x, 0.04, plaza.z);
    pl.receiveShadow = true;
    g.add(pl);
    const plRing = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.12, 5, 48), stoneLight);
    plRing.rotation.x = Math.PI / 2;
    plRing.scale.z = 0.6;
    plRing.position.set(plaza.x, 0.06, plaza.z);
    g.add(plRing);
    // Inlaid tiles round the plaza, blue and red: the two sides of the duel. They glow softly, breathing.
    this.runeMat = new THREE.MeshStandardMaterial({ color: '#111', emissive: '#ffffff', emissiveIntensity: 0.9, vertexColors: false });
    const tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.04, 0.34), this.runeMat, 16);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      tiles.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(plaza.x + Math.cos(a) * 2.75, 0.06, plaza.z + Math.sin(a) * 2.75), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -a + Math.PI / 4, 0)), new THREE.Vector3(1, 1, 1)));
      tiles.setColorAt(i, new THREE.Color(i % 2 ? '#ff6b8b' : '#5cc8ff'));
    }
    g.add(tiles);
    // Tiered fountain: an octagonal basin, a pedestal, two bowls and a gold finial.
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.65, 0.5, 8, 1, true), stoneLight);
    basin.position.set(plaza.x, 0.25, plaza.z);
    basin.castShadow = basin.receiveShadow = true;
    g.add(basin);
    const basinRim = new THREE.Mesh(new THREE.TorusGeometry(1.58, 0.1, 5, 8), stoneLight);
    basinRim.rotation.x = Math.PI / 2;
    basinRim.rotation.z = Math.PI / 8;
    basinRim.position.set(plaza.x, 0.5, plaza.z);
    g.add(basinRim);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(1.5, 8), shareTime(water(time, '#3a3a8a', 1), time));
    pool.rotation.x = -Math.PI / 2;
    pool.rotation.z = Math.PI / 8;
    pool.position.set(plaza.x, 0.42, plaza.z);
    g.add(pool);
    const bowlPts = [new THREE.Vector2(0.12, 0), new THREE.Vector2(0.35, 0.05), new THREE.Vector2(0.7, 0.2), new THREE.Vector2(0.82, 0.32), new THREE.Vector2(0.78, 0.36), new THREE.Vector2(0.6, 0.26), new THREE.Vector2(0.12, 0.2)];
    const ped = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(0.35, 0), new THREE.Vector2(0.22, 0.2), new THREE.Vector2(0.14, 0.6), new THREE.Vector2(0.2, 1.0), new THREE.Vector2(0.12, 1.5), new THREE.Vector2(0.16, 2.0)], 16), stoneLight);
    ped.position.set(plaza.x, 0.4, plaza.z);
    ped.castShadow = true;
    g.add(ped);
    for (const [y, s] of [
      [1.25, 1],
      [2.05, 0.55],
    ] as const) {
      const bowl = new THREE.Mesh(new THREE.LatheGeometry(bowlPts, 20), stoneLight);
      bowl.scale.setScalar(s);
      bowl.position.set(plaza.x, y, plaza.z);
      bowl.castShadow = true;
      g.add(bowl);
      const wtr = new THREE.Mesh(new THREE.CircleGeometry(0.62 * s, 20), shareTime(water(time, '#3a3a8a', 1), time));
      wtr.rotation.x = -Math.PI / 2;
      wtr.position.set(plaza.x, y + 0.3 * s, plaza.z);
      g.add(wtr);
    }
    const fin = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), gold);
    fin.position.set(plaza.x, 2.55, plaza.z);
    g.add(fin);
    this.fountainTop.set(plaza.x, 2.6, plaza.z);
    if (hi) this.addLight(new THREE.Vector3(plaza.x, 3.2, plaza.z + 1.5), '#9fc4ff', 0.5);

    // ── The reflecting pool between cypresses ──
    const rp = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 11), shareTime(water(time, '#2f2b78', 1), time));
    rp.rotation.x = -Math.PI / 2;
    rp.position.set(0, 0.1, 1.4);
    g.add(rp);
    const rimGeo = new THREE.BoxGeometry(0.3, 0.22, 11.3);
    for (const x of [-1.25, 1.25]) {
      const rim = new THREE.Mesh(rimGeo, stoneLight);
      rim.position.set(x, 0.11, 1.4);
      rim.receiveShadow = true;
      g.add(rim);
    }
    const endGeo = new THREE.BoxGeometry(2.8, 0.22, 0.3);
    for (const z of [-4.2, 7.0]) {
      const e = new THREE.Mesh(endGeo, stoneLight);
      e.position.set(0, 0.11, z);
      g.add(e);
    }
    // Lily pads and a few glowing lotus buds.
    const pads: THREE.Matrix4[] = [];
    for (let i = 0; i < 9; i++) pads.push(new THREE.Matrix4().compose(new THREE.Vector3((rnd() - 0.5) * 1.6, 0.115, -3.5 + rnd() * 10), new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, rnd() * 6)), new THREE.Vector3(1, 1, 1).multiplyScalar(0.7 + rnd() * 0.6)));
    const padMesh = new THREE.InstancedMesh(new THREE.CircleGeometry(0.22, 12, 0.4, Math.PI * 2 - 0.4), new THREE.MeshStandardMaterial({ color: '#2f6b45', roughness: 0.8, side: THREE.DoubleSide }), pads.length);
    pads.forEach((m, i) => padMesh.setMatrixAt(i, m));
    g.add(padMesh);
    this.flowerMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.55, roughness: 0.6 });
    const lotus = new THREE.InstancedMesh(new THREE.ConeGeometry(0.07, 0.14, 6), this.flowerMat, 4);
    for (let i = 0; i < 4; i++) {
      const p = new THREE.Vector3().setFromMatrixPosition(pads[i * 2]!);
      lotus.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x + 0.05, 0.19, p.z));
      lotus.setColorAt(i, new THREE.Color('#ff9ec4'));
    }
    g.add(lotus);

    // ── Lanterns along the roads ──
    const postGeo = mergeGeometries([new THREE.CylinderGeometry(0.05, 0.07, 1.9, 6).translate(0, 0.95, 0), new THREE.BoxGeometry(0.22, 0.12, 0.22).translate(0, 0.06, 0), new THREE.ConeGeometry(0.2, 0.18, 4).rotateY(Math.PI / 4).translate(0, 2.35, 0)].map((x) => x.toNonIndexed()))!;
    const lampGeo = new THREE.BoxGeometry(0.2, 0.3, 0.2).translate(0, 2.1, 0);
    const lanternAt: THREE.Vector3[] = [];
    for (const path of this.paths) {
      for (let i = 2; i < path.length - 1; i += 4) {
        const a = path[i]!;
        const b = path[i + 1]!;
        const n = new THREE.Vector3(-(b.z - a.z), 0, b.x - a.x).normalize().multiplyScalar(i % 8 === 2 ? 1.25 : -1.25);
        const p = a.clone().add(n);
        if (lanternAt.some((q) => q.distanceTo(p) < 2.4) || p.distanceTo(plaza) < 3.9) continue;
        lanternAt.push(p);
      }
    }
    for (const a of [Math.PI * 0.25, Math.PI * 0.75]) lanternAt.push(new THREE.Vector3(plaza.x + Math.cos(a) * 3.0, 0, plaza.z - Math.sin(a) * 3.0));
    const posts = new THREE.InstancedMesh(postGeo, iron, lanternAt.length);
    const lamps = new THREE.InstancedMesh(lampGeo, this.lanternMat, lanternAt.length);
    lanternAt.forEach((p, i) => {
      p.y = heightAt(p.x, p.z);
      const m = new THREE.Matrix4().makeTranslation(p.x, p.y, p.z);
      posts.setMatrixAt(i, m);
      lamps.setMatrixAt(i, m);
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffb060', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.7 }));
      s.position.set(p.x, p.y + 2.1, p.z);
      s.scale.setScalar(1.6);
      g.add(s);
      this.lanternGlows.push({ s, base: 0.7, ph: rnd() * 10 });
      // A warm pool of light on the ground below each lantern (a cheap fake of a light).
      const pool2 = new THREE.Mesh(new THREE.CircleGeometry(1.4, 20), new THREE.MeshBasicMaterial({ map: glowTex, color: '#ff9a4a', transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
      pool2.rotation.x = -Math.PI / 2;
      pool2.position.set(p.x, p.y + 0.06, p.z);
      g.add(pool2);
    });
    posts.castShadow = true;
    g.add(posts, lamps);

    // ── Trees ──
    const allowed = (x: number, z: number, pad = 0) => {
      for (const c of castles) if (Math.hypot(x - c.position.x, z - c.position.z) < 9.6 + pad) return false;
      if (Math.abs(x) < 5.5 + pad && z > -6 && z < 15) return false; // the garden and the plaza
      if (z > 13 && Math.abs(x) < 9 + (z - 13) * 1.1) return false; // keep the view open toward the camera
      for (const path of this.paths) for (const p of path) if (Math.hypot(p.x - x, p.z - z) < 1.6 + pad) return false;
      if (Math.hypot(x + 9, z + 44) < 9) return false; // the waterfall pool
      if (Math.hypot(x - 12, z + 78) < 12) return false; // the lighthouse hill
      return true;
    };
    const pineM: Place[] = [];
    const oakM: Place[] = [];
    const nTrees = hi ? 260 : 110;
    for (let tries = 0; pineM.length + oakM.length < nTrees && tries < 6000; tries++) {
      const x = (rnd() - 0.5) * 170;
      const z = 30 - rnd() * 130;
      if (!allowed(x, z, 0.6)) continue;
      // Thicker woods behind the castles and at the sides, thinner in the open middle.
      const keep = Math.abs(x) > 18 || z < -16 ? 1 : 0.12;
      if (rnd() > keep) continue;
      (rnd() < 0.62 ? pineM : oakM).push({ x, z, rot: rnd() * 6.28 });
    }
    const cypress: Place[] = [];
    for (let z = -3.6; z <= 6.4; z += 2.5) for (const x of [-2.3, 2.3]) cypress.push({ x, z, rot: rnd() * 6 });
    // Cypress pairs also stand guard by the castles' back corners.
    for (const c of castles) for (const [lx, lz] of [[-5.8, -7.6], [5.8, -7.6], [-8.6, 2.4], [8.6, 2.4]] as const) {
      const p = local(c, lx, lz);
      if (allowed(p.x, p.z, -0.6)) cypress.push({ x: p.x, z: p.z, rot: rnd() * 6 });
    }
    const palms: Place[] = [
      { x: -3.4, z: -5.6, rot: 2.2 },
      { x: 3.4, z: -5.4, rot: 0.9 },
      { x: -4.0, z: -2.0, rot: 2.8 },
      { x: 4.0, z: -1.6, rot: 0.3 },
      { x: -11.5, z: -48, rot: 1.4 },
      { x: -5, z: -47, rot: 0.2 },
    ];
    const leafCol = (base: string, i: number) => new THREE.Color(base).offsetHSL(((i * 37) % 11) / 300 - 0.015, 0, ((i * 53) % 13) / 140 - 0.045);
    const instanced = (geo: THREE.BufferGeometry, mat: THREE.Material, list: Place[], scale: (i: number) => number, color?: (i: number) => THREE.Color, cast = hi) => {
      const m = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((p, i) => {
        const s = scale(i);
        m.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(p.x, heightAt(p.x, p.z) - 0.05, p.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, p.rot, 0)), new THREE.Vector3(s, s * (0.9 + ((i * 7) % 5) * 0.06), s)));
        if (color) m.setColorAt(i, color(i));
      });
      m.castShadow = cast;
      m.receiveShadow = true;
      g.add(m);
      return m;
    };
    const bark = new THREE.MeshStandardMaterial({ color: '#4a3a34', roughness: 1, flatShading: true });
    const pineMat = sway(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, flatShading: true }), 0.0035, time, 'pine');
    const oakMat = sway(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, flatShading: true }), 0.006, time, 'oak');
    const cypMat = sway(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, flatShading: true }), 0.004, time, 'cyp');
    const frondMat = sway(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8, side: THREE.DoubleSide, flatShading: true }), 0.012, time, 'palm');
    const scaleFar = (list: Place[]) => (i: number) => {
      const p = list[i]!;
      return (0.8 + ((i * 13) % 7) * 0.09) * (1 + Math.max(0, -p.z - 20) / 60);
    };
    instanced(trunkGeo(1.6, 0.2, false), bark, pineM, scaleFar(pineM));
    instanced(pineGeo(), pineMat, pineM, scaleFar(pineM), (i) => leafCol('#24574e', i));
    instanced(trunkGeo(2.4, 0.26, true), bark, oakM, scaleFar(oakM));
    instanced(oakGeo(), oakMat, oakM, scaleFar(oakM), (i) => leafCol(i % 4 ? '#2f6544' : '#4a5d2c', i));
    instanced(trunkGeo(0.8, 0.12, false), bark, cypress, () => 1);
    instanced(cypressGeo(), cypMat, cypress, (i) => 0.85 + ((i * 5) % 4) * 0.08, (i) => leafCol('#1b4a3c', i));
    const palm = palmGeo();
    instanced(palm.trunk, new THREE.MeshStandardMaterial({ color: '#6a5242', roughness: 0.95, flatShading: true }), palms, (i) => 0.95 + (i % 3) * 0.12);
    instanced(palm.fronds, frondMat, palms, (i) => 0.95 + (i % 3) * 0.12, (i) => leafCol('#3f8150', i));

    // ── Grass, flowers and rocks ──
    const nGrass = hi ? 3600 : 900;
    const grass = new THREE.InstancedMesh(grassGeo(), sway(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 1 }), 0.9, time, 'grass'), nGrass);
    const flowers: THREE.Matrix4[] = [];
    let n = 0;
    for (let tries = 0; n < nGrass && tries < nGrass * 6; tries++) {
      const r = 9 + Math.pow(rnd(), 0.7) * 34;
      const a = rnd() * Math.PI * 2;
      const x = Math.cos(a) * r * 1.3;
      const z = Math.sin(a) * r - 2;
      if (!allowed(x, z, -0.4) && !(Math.abs(x) < 5.5 && z > -6 && z < 15 && Math.abs(x) > 1.6 && Math.hypot(x, z - 10.5) > 3.6)) continue;
      const s = 0.8 + rnd() * 0.9;
      grass.setMatrixAt(n++, new THREE.Matrix4().compose(new THREE.Vector3(x, heightAt(x, z), z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rnd() * 6, 0)), new THREE.Vector3(s, s, s)));
      if (rnd() < 0.05) flowers.push(new THREE.Matrix4().makeTranslation(x + 0.1, heightAt(x, z) + 0.3 * s, z));
    }
    grass.count = n;
    grass.receiveShadow = true;
    g.add(grass);
    const fl = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.06, 0), this.flowerMat, flowers.length);
    const fcols = ['#f5d0fe', '#fde68a', '#bae6fd', '#fecdd3'];
    flowers.forEach((m, i) => {
      fl.setMatrixAt(i, m);
      fl.setColorAt(i, new THREE.Color(fcols[i % 4]!));
    });
    g.add(fl);
    for (let i = 0; i < (hi ? 70 : 30); i++) {
      const x = (rnd() - 0.5) * 110;
      const z = 24 - rnd() * 90;
      if (allowed(x, z, 0.4)) rock(x, z, 0.3 + rnd() * rnd() * 2.2);
    }

    // ── The waterfall: a rocky cliff, the falls, a pool, mist ──
    const fx = -9;
    const fz = -46;
    const cliff: [number, number, number, number][] = [
      [fx - 4, 5, fz - 4, 6],
      [fx + 4, 4.5, fz - 4.5, 5.5],
      [fx, 9, fz - 6, 6],
      [fx - 6, 9.5, fz - 7, 5],
      [fx + 6, 8.5, fz - 7, 5.5],
      [fx - 2.5, 13, fz - 8, 4.2],
      [fx + 3, 12.5, fz - 8.5, 4],
      [fx, 15.5, fz - 10, 3.6],
      [fx - 8, 3.5, fz - 1, 3.5],
      [fx + 8, 3.5, fz - 1.5, 3.2],
    ];
    const cliffMat = new THREE.MeshStandardMaterial({ color: '#5d5878', roughness: 1, flatShading: true });
    const cliffMesh = new THREE.InstancedMesh(rockGeo, cliffMat, cliff.length);
    cliff.forEach(([x, y, z, s], i) => cliffMesh.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(x, y + heightAt(x, z), z), new THREE.Quaternion().setFromEuler(new THREE.Euler(i, i * 2, 0)), new THREE.Vector3(s, s * 1.1, s * 0.9))));
    cliffMesh.receiveShadow = true;
    g.add(cliffMesh);
    const fallsMat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 } }]),
      vertexShader: /* glsl */ `
        #include <fog_pars_vertex>
        varying vec2 vUv;
        void main() { vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; varying vec2 vUv;
        #include <fog_pars_fragment>
        float h(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
        void main() {
          float col = floor(vUv.x * 34.);
          float n = h(col);
          float s = sin((vUv.y * (6. + n * 4.) + uTime * (1.6 + n * 1.4)) * 6.2831 + n * 40.) * 0.5 + 0.5;
          float edge = smoothstep(0., 0.18, vUv.x) * smoothstep(1., 0.82, vUv.x);
          vec3 c = mix(vec3(0.35, 0.42, 0.78), vec3(0.9, 0.94, 1.), pow(s, 3.));
          float foam = smoothstep(0.12, 0., vUv.y);
          c = mix(c, vec3(1.), foam * 0.6);
          gl_FragColor = vec4(c, (0.55 + 0.35 * s) * edge);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
      transparent: true,
      depthWrite: false,
      fog: true,
      side: THREE.DoubleSide,
    });
    fallsMat.uniforms.uTime = time;
    const fallsTop = 14 + heightAt(fx, fz);
    const falls = new THREE.Mesh(new THREE.PlaneGeometry(2.6, fallsTop, 1, 12), fallsMat);
    // Bow it outward a little, like water leaving the lip.
    const fpos = falls.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < fpos.count; i++) {
      const v = (fpos.getY(i) + fallsTop / 2) / fallsTop;
      fpos.setZ(i, Math.sin(v * Math.PI) * 0.8 + (1 - v) * 0.6);
    }
    falls.position.set(fx, fallsTop / 2 + heightAt(fx, fz) - 0.3, fz - 2.6);
    g.add(falls);
    const fpool = new THREE.Mesh(new THREE.CircleGeometry(5.2, 32), shareTime(water(time, '#3a4a9a', 1), time));
    fpool.rotation.x = -Math.PI / 2;
    fpool.position.set(fx, heightAt(fx, fz) + 0.15, fz + 1);
    g.add(fpool);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      rock(fx + Math.cos(a) * 5.4, fz + 1 + Math.sin(a) * 5.4, 0.5 + rnd() * 0.8);
    }
    this.fallsBase.set(fx, heightAt(fx, fz) + 0.4, fz - 1.6);

    // ── The lighthouse on its hill, with a village at its foot ──
    const lx = 12;
    const lz = -80;
    const hillY = heightAt(lx, lz);
    const hill = new THREE.Mesh(jitter(new THREE.SphereGeometry(14, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), 1.2, 5), new THREE.MeshStandardMaterial({ color: '#2a3140', roughness: 1, flatShading: true }));
    hill.scale.y = 0.5;
    hill.position.set(lx, hillY - 1, lz);
    g.add(hill);
    const top = hillY - 1 + 7;
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.7, 16, 16), new THREE.MeshStandardMaterial({ color: '#d9d4e6', roughness: 0.8 }));
    tower.position.set(lx, top + 8, lz);
    g.add(tower);
    const bandMat = new THREE.MeshStandardMaterial({ color: '#7b2b3a', roughness: 0.8 });
    for (const y of [3, 7.5, 12]) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(1.7 - (y / 16) * 0.6 + 0.02, 1.7 - ((y - 1.2) / 16) * 0.6 + 0.02, 1.2, 16), bandMat);
      b.position.set(lx, top + y, lz);
      g.add(b);
    }
    const gallery = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.3, 0.4, 16), stoneLight);
    gallery.position.set(lx, top + 16.2, lz);
    g.add(gallery);
    this.beamLamp = new THREE.MeshBasicMaterial({ color: '#fff1c4', toneMapped: false });
    const lampRoom = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.4, 12), this.beamLamp);
    lampRoom.position.set(lx, top + 17.1, lz);
    g.add(lampRoom);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.05, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), gold);
    dome.position.set(lx, top + 17.8, lz);
    g.add(dome);
    const lglow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffe2a0', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9 }));
    lglow.scale.setScalar(9);
    lglow.position.set(lx, top + 17.1, lz);
    g.add(lglow);
    // Two opposite beams sweeping round.
    this.beam = new THREE.Group();
    this.beam.position.set(lx, top + 17.1, lz);
    const beamMat = new THREE.ShaderMaterial({
      uniforms: {},
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
      fragmentShader: 'varying vec2 vUv; void main(){ float a = pow(vUv.y, 2.2) * 0.16 * (0.6 + 0.4 * sin(vUv.x * 6.2831)); gl_FragColor = vec4(1., 0.92, 0.7, a); }',
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    for (const s of [1, -1]) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(5, 60, 20, 1, true), beamMat);
      cone.geometry.translate(0, -30, 0);
      cone.rotation.z = (s * Math.PI) / 2;
      this.beam.add(cone);
    }
    g.add(this.beam);
    // The village: little houses with lit windows down the hill's flank.
    const houseGeo = new THREE.BoxGeometry(1.6, 1.2, 1.3).translate(0, 0.6, 0);
    const houseRoof = new THREE.ConeGeometry(1.25, 0.8, 4).rotateY(Math.PI / 4).translate(0, 1.6, 0);
    const winGeo = mergeGeometries([new THREE.PlaneGeometry(0.22, 0.3).translate(-0.4, 0.65, 0.66), new THREE.PlaneGeometry(0.22, 0.3).translate(0.35, 0.65, 0.66)])!;
    const houses: Place[] = [];
    for (let i = 0; i < 14; i++) {
      const a = -2.6 + (i / 13) * 2.2 + rnd() * 0.15;
      const r = 9 + rnd() * 6;
      houses.push({ x: lx + Math.cos(a) * r, z: lz + 10 + Math.sin(a) * r * 0.5 + 4, rot: rnd() * 0.8 - 0.4 });
    }
    instanced(houseGeo, new THREE.MeshStandardMaterial({ color: '#b9a99a', roughness: 0.9 }), houses, () => 1, undefined, false);
    instanced(houseRoof, new THREE.MeshStandardMaterial({ color: '#7a3b30', roughness: 0.8, flatShading: true }), houses, () => 1, undefined, false);
    instanced(winGeo, this.lanternMat, houses, () => 1, undefined, false);

    // ── Sky: clouds, a low mist and a shooting star ──
    const cloudTex = softTexture(0.25);
    for (let i = 0; i < (hi ? 16 : 9); i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, color: new THREE.Color('#5a4c9c').offsetHSL(0, 0, rnd() * 0.08), transparent: true, opacity: 0.22 + rnd() * 0.2, depthWrite: false, fog: false }));
      s.position.set((rnd() - 0.5) * 300, 34 + rnd() * 30, -110 - rnd() * 70);
      s.scale.set(50 + rnd() * 60, 12 + rnd() * 10, 1);
      g.add(s);
      this.clouds.push({ s, v: 0.6 + rnd() * 0.9 });
    }
    for (let i = 0; i < (hi ? 10 : 5); i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, color: '#8a84c4', transparent: true, opacity: 0.1 + rnd() * 0.06, depthWrite: false }));
      s.position.set((rnd() - 0.5) * 140, 1.5 + rnd() * 2, -25 - rnd() * 40);
      s.scale.set(30 + rnd() * 30, 4 + rnd() * 3, 1);
      g.add(s);
      this.clouds.push({ s, v: 0.3 + rnd() * 0.4 });
    }
    this.star = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffffff', blending: THREE.AdditiveBlending, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    this.star.scale.set(6, 0.25, 1);
    g.add(this.star);

    // ── Fireflies over the garden and the woods' edge ──
    const nf = hi ? 90 : 40;
    this.flyBase = new Float32Array(nf * 4);
    const fpos2 = new Float32Array(nf * 3);
    for (let i = 0; i < nf; i++) {
      const garden = i % 3 === 0;
      const x = garden ? (rnd() - 0.5) * 9 : (rnd() < 0.5 ? -1 : 1) * (15 + rnd() * 14);
      const z = garden ? -4 + rnd() * 16 : -14 + rnd() * 24;
      this.flyBase.set([x, heightAt(x, z) + 0.5 + rnd() * 1.8, z, rnd() * 100], i * 4);
    }
    const fgeo = new THREE.BufferGeometry();
    fgeo.setAttribute('position', new THREE.BufferAttribute(fpos2, 3));
    fgeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(nf * 3), 3));
    this.fireflies = new THREE.Points(fgeo, new THREE.PointsMaterial({ size: 0.22, map: glowTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.fireflies.frustumCulled = false;
    g.add(this.fireflies);

    // ── Birds circling the lighthouse ──
    const wingGeo = new THREE.BufferGeometry();
    wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.12, 0, 0, 0.12, 0.7, 0.05, 0], 3));
    const birdMat = new THREE.MeshBasicMaterial({ color: '#0d0b1c', side: THREE.DoubleSide });
    for (let i = 0; i < 7; i++) {
      const b = new THREE.Group();
      const l = new THREE.Mesh(wingGeo, birdMat);
      const r = new THREE.Mesh(wingGeo, birdMat);
      r.scale.x = -1;
      b.add(l, r);
      b.scale.setScalar(1.4);
      g.add(b);
      this.birds.push({ g: b, wings: [l, r], r: 8 + rnd() * 8, h: top + 12 + rnd() * 8, sp: 0.25 + rnd() * 0.2, ph: rnd() * 6.28 });
    }

    // Rocks last: everything above has added to the list.
    const rockMesh = new THREE.InstancedMesh(rockGeo, stone, rocks.length);
    rocks.forEach((m, i) => rockMesh.setMatrixAt(i, m));
    rockMesh.castShadow = hi;
    rockMesh.receiveShadow = true;
    g.add(rockMesh);

    // Water particles: the fountain's spray and the waterfall's mist.
    this.spray = new Particles(hi ? 500 : 220, softTexture(0.4), { additive: true });
    this.mist = new Particles(hi ? 260 : 120, softTexture(0.1));
    g.add(this.mist.points, this.spray.points);
  }

  private addLight(at: THREE.Vector3, color = '#ffb060', k = 1) {
    const l = new THREE.PointLight(color, 9 * k, 9, 2);
    l.position.copy(at);
    this.group.add(l);
    this.lights.push({ l, base: 9 * k });
  }

  /** A cobbled road along a curve: a flat ribbon just above the ground, with stones along its edges. */
  private road(curve: THREE.CatmullRomCurve3, width: number, mat: THREE.Material) {
    const n = Math.max(12, Math.round(curve.getLength() * 2.5));
    const pts = curve.getSpacedPoints(n);
    this.paths.push(pts);
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    let along = 0;
    pts.forEach((p, i) => {
      const a = pts[Math.max(0, i - 1)]!;
      const b = pts[Math.min(n, i + 1)]!;
      const t = b.clone().sub(a).normalize();
      const nrm = new THREE.Vector3(-t.z, 0, t.x);
      if (i) along += p.distanceTo(pts[i - 1]!);
      for (const s of [-1, 1]) {
        const q = p.clone().addScaledVector(nrm, (s * width) / 2);
        pos.push(q.x, heightAt(q.x, q.z) + 0.035, q.z);
        uv.push((s + 1) / 2 * (width / 2), along / 2);
      }
      if (i < n) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat);
    m.receiveShadow = true;
    this.group.add(m);
  }

  /** One frame of the world's life. `wind` lifts while a question runs; `heat` dims the lanterns' calm. */
  update(t: number, dt: number, wind: number) {
    this.time.value = t * (0.85 + wind * 0.15);
    // Lanterns flicker on their own, never in step.
    for (const l of this.lanternGlows) {
      const f = 0.85 + Math.sin(t * 7.3 + l.ph) * 0.06 + Math.sin(t * 13.1 + l.ph * 2) * 0.05 + (Math.random() - 0.5) * 0.06;
      (l.s.material as THREE.SpriteMaterial).opacity = l.base * f;
      l.s.scale.setScalar(1.6 * (0.95 + f * 0.08));
    }
    this.lanternMat.emissiveIntensity = 2 + Math.sin(t * 9.1) * 0.15 + Math.sin(t * 17.3) * 0.1;
    for (const [i, { l, base }] of this.lights.entries()) l.intensity = base * (0.9 + Math.sin(t * 8 + i * 3) * 0.06 + Math.random() * 0.06);
    this.runeMat.emissiveIntensity = 0.6 + Math.sin(t * 1.4) * 0.35;
    this.flowerMat.emissiveIntensity = 0.4 + Math.sin(t * 0.9) * 0.15;
    // Clouds drift; the far ones wrap round.
    for (const c of this.clouds) {
      c.s.position.x += c.v * dt * (0.8 + wind * 0.4);
      if (c.s.position.x > 160) c.s.position.x = -160;
    }
    // The lighthouse beam turns; its lamp breathes.
    this.beam.rotation.y = t * 0.45;
    this.beamLamp.color.setScalar(0.9 + Math.sin(t * 3) * 0.08);
    // Fireflies wander and blink.
    const fp = this.fireflies.geometry.attributes.position as THREE.BufferAttribute;
    const fc = this.fireflies.geometry.attributes.color as THREE.BufferAttribute;
    for (let i = 0; i < fp.count; i++) {
      const [x, y, z, ph] = [this.flyBase[i * 4]!, this.flyBase[i * 4 + 1]!, this.flyBase[i * 4 + 2]!, this.flyBase[i * 4 + 3]!];
      fp.setXYZ(i, x + Math.sin(t * 0.4 + ph) * 1.4 + Math.sin(t * 1.3 + ph * 2) * 0.3, y + Math.sin(t * 0.7 + ph * 3) * 0.5, z + Math.cos(t * 0.35 + ph) * 1.4);
      const b = Math.max(0, Math.sin(t * 1.6 + ph * 7)) ** 3;
      fc.setXYZ(i, 0.85 * b, 1.0 * b, 0.45 * b);
    }
    fp.needsUpdate = true;
    fc.needsUpdate = true;
    // Birds round the lighthouse, flapping now and then.
    for (const b of this.birds) {
      const a = t * b.sp + b.ph;
      b.g.position.set(12 + Math.cos(a) * b.r, b.h + Math.sin(a * 2) * 0.8, -80 + Math.sin(a) * b.r * 0.6);
      b.g.rotation.y = -a;
      const flap = Math.sin(t * 9 + b.ph) * (Math.sin(t * 0.7 + b.ph) > 0 ? 0.7 : 0.15);
      b.wings[0].rotation.z = flap;
      b.wings[1].rotation.z = -flap;
    }
    // A shooting star every so often.
    this.starT -= dt;
    const sm = this.star.material as THREE.SpriteMaterial;
    if (this.starT <= 0) {
      this.starT = 9 + Math.random() * 14;
      this.star.position.set(-60 + Math.random() * 120, 55 + Math.random() * 20, -150);
      this.starV.set(-28 - Math.random() * 18, -10, 0);
      sm.rotation = Math.atan2(this.starV.y, this.starV.x);
      sm.opacity = 1;
    }
    if (sm.opacity > 0) {
      this.star.position.addScaledVector(this.starV, dt);
      sm.opacity = Math.max(0, sm.opacity - dt * 1.4);
    }
    // Fountain spray and waterfall mist.
    const k = this.tier === 'high' ? 1 : 0.5;
    for (let i = 0; i < 3 * k; i++) {
      const a = Math.random() * Math.PI * 2;
      this.spray.emit(this.fountainTop, new THREE.Vector3(Math.cos(a) * 0.5, 2.4 + Math.random() * 0.6, Math.sin(a) * 0.5), { life: 1.1, size: 0.22, grow: -0.05, color: '#b8d4ff', alpha: 0.55, gravity: 6 });
    }
    if (Math.random() < 0.6 * k) {
      const a = Math.random() * Math.PI * 2;
      this.spray.emit(new THREE.Vector3(this.fountainTop.x + Math.cos(a) * 0.62, 1.55, this.fountainTop.z + Math.sin(a) * 0.62), new THREE.Vector3(Math.cos(a) * 0.4, 0.2, Math.sin(a) * 0.4), { life: 0.6, size: 0.16, color: '#a9c8ff', alpha: 0.5, gravity: 7 });
    }
    if (Math.random() < 0.5 * k) {
      this.mist.emit(this.fallsBase.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2.4, 0, Math.random())), new THREE.Vector3((Math.random() - 0.5) * 1.2, 0.8 + Math.random() * 0.6, 0.6 + Math.random() * 0.6), { life: 3, size: 2.2, grow: 1.6, color: '#c9d2ff', alpha: 0.32, drag: 0.6 });
    }
    this.spray.update(dt);
    this.mist.update(dt);
  }
}
