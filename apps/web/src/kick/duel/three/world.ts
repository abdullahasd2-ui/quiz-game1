// The world around the two castles: an Andalusian night garden between two fortresses, in a valley under mountains.
//   Land: carved terrain (moats with a stone-lined inner wall and natural banks, a formal pool, a plunge pool), painted
//   by slope and wetness, with caustics on everything under water; three ranges of ridged mountains behind.
//   Water: depth-coloured, see-through at the edges, reflecting a live capture of the scene, foaming along every shore,
//   with the moon's path and the lanterns' streaks on it.
//   Garden: cobbled roads lit by brass lanterns, a plaza and tiered fountain, the reflecting pool between cypresses and
//   date palms, a horseshoe arch at its far end, olive groves, flowering shrubs.
//   Wild land: oaks and pines grown from branching skeletons, curved grass in clumps, reeds on the banks, boulders in
//   natural groups, a cliff with a waterfall and its pool, a hill village and a lighthouse whose beam sweeps the sky.
//   Life: wind gusts through trees and grass, fireflies, birds, drifting cloud and mist, a shooting star now and then.
// Everything is generated in code, instanced where it repeats, and thinned out on the low tier.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { cobbleTexture, groundTexture, stoneTextures } from './textures';
import { Particles, softTexture } from './particles';
import { buildGround, buildMountains, FALLS, FALLS_POOL, fallsPoolY, heightAt, LIGHTHOUSE, MOAT, MOAT_Y, POOL_Y, rockGeometry, withCaustics } from './terrain';
import { bakeDepth, fallsMaterial, MAX_GLINTS, waterMaterial, waveTexture, type WaterShared } from './water';
import { grassClump, reedClump, shrub, treeKit, windy, type TreeKind } from './flora';

export { heightAt } from './terrain';
export type Tier = 'high' | 'low';
type Place = { x: number; z: number; rot: number; s?: number };

function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

export class World {
  readonly group = new THREE.Group();
  readonly spray: Particles;
  readonly mist: Particles;
  private readonly time = { value: 0 };
  private readonly water: WaterShared;
  private readonly waterMeshes: THREE.Object3D[] = [];
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
  private readonly starV = new THREE.Vector3();
  private readonly lights: { l: THREE.PointLight; base: number }[] = [];
  private readonly fountainTop = new THREE.Vector3();
  private readonly fallsBase = new THREE.Vector3();
  private readonly tier: Tier;
  private readonly paths: THREE.Vector3[][] = [];
  private readonly cube: THREE.CubeCamera;
  private readonly cubeRT: THREE.WebGLCubeRenderTarget;
  private pmrem: THREE.PMREMGenerator | null = null;
  private envRT: THREE.WebGLRenderTarget | null = null;
  private captureIn = 0.4;

  constructor(castles: { position: THREE.Vector3; rotY: number }[], tier: Tier) {
    this.tier = tier;
    const hi = tier === 'high';
    const g = this.group;
    const time = this.time;
    const rnd = seeded(2027);
    const glowTex = softTexture(0.05);
    const local = (c: (typeof castles)[number], x: number, z: number) => new THREE.Vector3(x, 0, z).applyAxisAngle(new THREE.Vector3(0, 1, 0), c.rotY).add(c.position);

    // The scene captured from the garden, for the water's reflections and the materials' ambient light.
    this.cubeRT = new THREE.WebGLCubeRenderTarget(hi ? 256 : 128, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    this.cube = new THREE.CubeCamera(0.5, 480, this.cubeRT);
    this.cube.position.set(0, 0.9, 3);
    this.water = { time, waves: waveTexture(256), env: { value: this.cubeRT.texture }, hasEnv: { value: 0 }, glints: { value: Array.from({ length: MAX_GLINTS }, () => new THREE.Vector3()) }, glintCount: { value: 0 } };

    // ── Land ──
    g.add(buildGround(groundTexture(), time, hi));
    g.add(buildMountains(hi));

    // ── Materials ──
    const st = stoneTextures();
    const dressed = new THREE.MeshStandardMaterial({ map: st.map, normalMap: st.normal, normalScale: new THREE.Vector2(0.8, 0.8), roughnessMap: st.rough, color: '#c9c3d6', roughness: 1 });
    const dressedCaustic = withCaustics(dressed.clone(), time, 'dressed');
    const marble = new THREE.MeshStandardMaterial({ color: '#9e97ad', roughness: 0.6, metalness: 0.02 });
    const iron = new THREE.MeshStandardMaterial({ color: '#2b2a33', metalness: 0.75, roughness: 0.42 });
    const brass = new THREE.MeshStandardMaterial({ color: '#c9973e', metalness: 0.9, roughness: 0.35 });
    const gold = new THREE.MeshStandardMaterial({ color: '#e8b64c', metalness: 0.9, roughness: 0.3, emissive: '#3a2200', emissiveIntensity: 0.4 });
    const copingMat = new THREE.MeshStandardMaterial({ color: '#6f6a82', roughness: 0.9, normalMap: st.normal });
    const cob = cobbleTexture([1, 1]);
    const road = new THREE.MeshStandardMaterial({ map: cob.map, normalMap: cob.normal, normalScale: new THREE.Vector2(1, 1), roughness: 0.88, color: '#c4c0d6' });
    this.lanternMat = new THREE.MeshStandardMaterial({ color: '#2a1a08', emissive: '#ffb35c', emissiveIntensity: 2.2 });
    const rockMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.93, map: st.map, normalMap: st.normal, normalScale: new THREE.Vector2(0.5, 0.5) });
    const rockGeos = [rockGeometry(1, hi ? 3 : 2), rockGeometry(2, hi ? 3 : 2), rockGeometry(3, hi ? 3 : 2)];
    const rocks: THREE.Matrix4[][] = [[], [], []];
    const rock = (x: number, z: number, s: number, flat = 0.65, sink = 0.15) =>
      rocks[Math.floor(rnd() * 3)]!.push(new THREE.Matrix4().compose(new THREE.Vector3(x, heightAt(x, z) + s * (0.35 * flat - sink), z), new THREE.Quaternion().setFromEuler(new THREE.Euler((rnd() - 0.5) * 0.4, rnd() * 6.28, (rnd() - 0.5) * 0.4)), new THREE.Vector3(s, s * flat, s * (0.8 + rnd() * 0.4))));
    /** A natural group: one big stone, a few smaller ones leaning on it. */
    const outcrop = (x: number, z: number, s: number) => {
      rock(x, z, s, 0.7);
      for (let i = 0; i < 3 + Math.floor(rnd() * 3); i++) {
        const a = rnd() * Math.PI * 2;
        const d = s * (0.8 + rnd() * 0.6);
        rock(x + Math.cos(a) * d, z + Math.sin(a) * d, s * (0.25 + rnd() * 0.35), 0.6);
      }
    };

    // ── Moats ──
    const plaza = new THREE.Vector3(0, 0, 10.5);
    const reedSpots: Place[] = [];
    for (const c of castles) {
      const ringGeo = new THREE.RingGeometry(MOAT.inner - 0.05, MOAT.outer + 0.9, hi ? 160 : 80, hi ? 10 : 5);
      ringGeo.rotateX(-Math.PI / 2);
      bakeDepth(ringGeo, MOAT_Y, heightAt, c.position);
      const w = new THREE.Mesh(ringGeo, waterMaterial(this.water, { deep: '#071334', shallow: '#2e6f78' }));
      w.position.set(c.position.x, MOAT_Y, c.position.z);
      w.renderOrder = 2;
      g.add(w);
      this.waterMeshes.push(w);
      // The stone-lined inner wall, its coping, and iron mooring rings.
      const wall = new THREE.Mesh(new THREE.CylinderGeometry(MOAT.inner, MOAT.inner + 0.05, 1.0, hi ? 96 : 48, 1, true), dressedCaustic);
      (wall.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
      wall.position.set(c.position.x, -0.42, c.position.z);
      wall.receiveShadow = true;
      g.add(wall);
      const coping = new THREE.Mesh(new THREE.TorusGeometry(MOAT.inner + 0.02, 0.12, 6, hi ? 96 : 48), copingMat);
      coping.rotation.x = Math.PI / 2;
      coping.scale.z = 0.55;
      coping.position.set(c.position.x, 0.06, c.position.z);
      coping.receiveShadow = true;
      g.add(coping);
      // The landing where the drawbridge comes down: a stone pier with steps, flanked by lantern pillars.
      const lp = local(c, 0, 8.9);
      const land = new THREE.Mesh(new THREE.BoxGeometry(2.7, 1.2, 1.5), dressedCaustic);
      land.position.set(lp.x, -0.35, lp.z);
      land.rotation.y = c.rotY;
      land.castShadow = land.receiveShadow = true;
      g.add(land);
      for (const [k, sx] of [-1.2, 1.2].entries()) {
        const pp = local(c, sx, 9.3);
        const base = heightAt(pp.x, pp.z);
        const pil = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.4, 0.4), dressed);
        pil.position.set(pp.x, base + 0.5, pp.z);
        pil.rotation.y = c.rotY;
        pil.castShadow = true;
        g.add(pil);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.12, 0.52), marble);
        cap.position.set(pp.x, base + 1.26, pp.z);
        cap.rotation.y = c.rotY;
        g.add(cap);
        this.lantern(new THREE.Vector3(pp.x, base + 1.32, pp.z), glowTex, brass, rnd, true);
        if (k === 0 && hi) this.addLight(new THREE.Vector3(lp.x, 1.8, lp.z + 0.4));
      }
      // Reeds along the outer bank, rocks half in the water; the landing side stays clear.
      for (let i = 0; i < (hi ? 70 : 30); i++) {
        const a = rnd() * Math.PI * 2;
        const front = Math.abs(((a - Math.PI / 2 - c.rotY + Math.PI * 5) % (Math.PI * 2)) - Math.PI) < 0.42;
        if (front) continue;
        const r = MOAT.outer - 0.35 + rnd() * 0.6;
        const p = local(c, Math.cos(a) * r, Math.sin(a) * r);
        reedSpots.push({ x: p.x, z: p.z, rot: rnd() * 6, s: 0.7 + rnd() * 0.6 });
      }
      for (let i = 0; i < (hi ? 14 : 7); i++) {
        const a = rnd() * Math.PI * 2;
        const front = Math.abs(((a - Math.PI / 2 - c.rotY + Math.PI * 5) % (Math.PI * 2)) - Math.PI) < 0.5;
        if (front) continue;
        const p = local(c, Math.cos(a) * (MOAT.outer + 0.2), Math.sin(a) * (MOAT.outer + 0.2));
        rock(p.x, p.z, 0.3 + rnd() * 0.45, 0.6, 0.25);
      }
      // A road from the landing to the plaza.
      const side = Math.sign(c.position.x);
      this.road(new THREE.CatmullRomCurve3([local(c, 0, 9.65), local(c, 0, 11.3), new THREE.Vector3(side * 3.6, 0, 10.6), new THREE.Vector3(side * 2.4, 0, 10.5)]), 1.7, road);
    }
    // The road toward the viewer.
    this.road(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 13.2), new THREE.Vector3(0.4, 0, 18), new THREE.Vector3(-0.6, 0, 24), new THREE.Vector3(0.5, 0, 34)]), 1.9, road);

    // ── The plaza and its fountain ──
    const plazaMat = road.clone();
    const pc = cobbleTexture([4, 4]);
    plazaMat.map = pc.map;
    plazaMat.normalMap = pc.normal;
    const pl = new THREE.Mesh(new THREE.CircleGeometry(3.4, 64), plazaMat);
    pl.rotation.x = -Math.PI / 2;
    pl.position.set(plaza.x, 0.045, plaza.z);
    pl.receiveShadow = true;
    g.add(pl);
    const plRing = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.13, 6, 64), dressed);
    plRing.rotation.x = Math.PI / 2;
    plRing.scale.z = 0.5;
    plRing.position.set(plaza.x, 0.06, plaza.z);
    g.add(plRing);
    // An inlaid eight-pointed star round the fountain, its tiles alternating blue and red: the duel's two sides.
    this.runeMat = new THREE.MeshStandardMaterial({ color: '#111', emissive: '#ffffff', emissiveIntensity: 0.9 });
    const tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 0.03, 0.3), this.runeMat, 24);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const r = i % 3 === 0 ? 2.95 : 2.55;
      tiles.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(plaza.x + Math.cos(a) * r, 0.065, plaza.z + Math.sin(a) * r), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -a + Math.PI / 4, 0)), new THREE.Vector3(1, 1, 1)));
      tiles.setColorAt(i, new THREE.Color(i % 2 ? '#ff6b8b' : '#5cc8ff'));
    }
    g.add(tiles);
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.68, 0.55, 8, 1, true), dressed);
    basin.position.set(plaza.x, 0.27, plaza.z);
    basin.castShadow = basin.receiveShadow = true;
    (basin.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    g.add(basin);
    const basinRim = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.11, 6, 8), marble);
    basinRim.rotation.x = Math.PI / 2;
    basinRim.rotation.z = Math.PI / 8;
    basinRim.position.set(plaza.x, 0.55, plaza.z);
    g.add(basinRim);
    const fwGeo = new THREE.CircleGeometry(1.52, 8, Math.PI / 8).rotateX(-Math.PI / 2);
    fwGeo.setAttribute('depth', new THREE.BufferAttribute(new Float32Array(fwGeo.attributes.position!.count).fill(0.45), 1));
    const fw = new THREE.Mesh(fwGeo, waterMaterial(this.water, { foam: 0, scale: 2, shallow: '#3a7f8a' }));
    fw.position.set(plaza.x, 0.44, plaza.z);
    g.add(fw);
    this.waterMeshes.push(fw);
    const bowlPts = [new THREE.Vector2(0.12, 0), new THREE.Vector2(0.35, 0.05), new THREE.Vector2(0.7, 0.2), new THREE.Vector2(0.82, 0.32), new THREE.Vector2(0.78, 0.36), new THREE.Vector2(0.6, 0.26), new THREE.Vector2(0.12, 0.2)];
    const ped = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(0.38, 0), new THREE.Vector2(0.24, 0.2), new THREE.Vector2(0.15, 0.6), new THREE.Vector2(0.22, 1.0), new THREE.Vector2(0.13, 1.5), new THREE.Vector2(0.17, 2.0)], 20), marble);
    ped.position.set(plaza.x, 0.4, plaza.z);
    ped.castShadow = true;
    g.add(ped);
    for (const [y, s] of [
      [1.25, 1],
      [2.05, 0.55],
    ] as const) {
      const bowl = new THREE.Mesh(new THREE.LatheGeometry(bowlPts, 24), marble);
      bowl.scale.setScalar(s);
      bowl.position.set(plaza.x, y, plaza.z);
      bowl.castShadow = true;
      g.add(bowl);
      const bg = new THREE.CircleGeometry(0.62 * s, 24).rotateX(-Math.PI / 2);
      bg.setAttribute('depth', new THREE.BufferAttribute(new Float32Array(bg.attributes.position!.count).fill(0.2), 1));
      const bw = new THREE.Mesh(bg, waterMaterial(this.water, { foam: 0, scale: 3, shallow: '#3a7f8a' }));
      bw.position.set(plaza.x, y + 0.3 * s, plaza.z);
      g.add(bw);
      this.waterMeshes.push(bw);
    }
    const fin = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), gold);
    fin.position.set(plaza.x, 2.55, plaza.z);
    g.add(fin);
    this.fountainTop.set(plaza.x, 2.6, plaza.z);
    if (hi) this.addLight(new THREE.Vector3(plaza.x, 3.2, plaza.z + 1.5), '#9fc4ff', 0.5);

    // ── The reflecting pool, and the horseshoe arch at its end ──
    const rpGeo = new THREE.PlaneGeometry(2.2, 10.9, 6, 24).rotateX(-Math.PI / 2);
    bakeDepth(rpGeo, POOL_Y, heightAt, new THREE.Vector3(0, 0, 1.4));
    const rp = new THREE.Mesh(rpGeo, waterMaterial(this.water, { foam: 0, deep: '#081538', shallow: '#2a5d6e', clarity: 0.8, amp: 0.3 }));
    rp.position.set(0, POOL_Y, 1.4);
    rp.renderOrder = 2;
    g.add(rp);
    this.waterMeshes.push(rp);
    const rimGeo = new THREE.BoxGeometry(0.34, 0.75, 11.3);
    for (const x of [-1.27, 1.27]) {
      const rim = new THREE.Mesh(rimGeo, dressedCaustic);
      rim.position.set(x, -0.2, 1.4);
      rim.receiveShadow = true;
      g.add(rim);
    }
    const endGeo = new THREE.BoxGeometry(2.88, 0.75, 0.34);
    for (const z of [-4.22, 7.02]) {
      const e = new THREE.Mesh(endGeo, dressedCaustic);
      e.position.set(0, -0.2, z);
      g.add(e);
    }
    const pads: THREE.Matrix4[] = [];
    for (let i = 0; i < 11; i++) pads.push(new THREE.Matrix4().compose(new THREE.Vector3((rnd() - 0.5) * 1.6, POOL_Y + 0.012, -3.4 + rnd() * 10), new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, rnd() * 6)), new THREE.Vector3(1, 1, 1).multiplyScalar(0.7 + rnd() * 0.6)));
    const padMesh = new THREE.InstancedMesh(new THREE.CircleGeometry(0.22, 16, 0.4, Math.PI * 2 - 0.4), new THREE.MeshStandardMaterial({ color: '#3a7a4c', roughness: 0.55, side: THREE.DoubleSide }), pads.length);
    pads.forEach((m, i) => padMesh.setMatrixAt(i, m));
    padMesh.renderOrder = 3;
    g.add(padMesh);
    this.flowerMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.55, roughness: 0.6 });
    const lotus = new THREE.InstancedMesh(new THREE.ConeGeometry(0.07, 0.14, 6), this.flowerMat, 5);
    for (let i = 0; i < 5; i++) {
      const p = new THREE.Vector3().setFromMatrixPosition(pads[i * 2]!);
      lotus.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x + 0.05, POOL_Y + 0.08, p.z));
      lotus.setColorAt(i, new THREE.Color('#ff9ec4'));
    }
    g.add(lotus);
    this.arch(new THREE.Vector3(0, 0, -7.2), dressed, marble, gold, glowTex, brass, rnd);

    // ── Lanterns along the roads ──
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
    for (const p of lanternAt) {
      p.y = heightAt(p.x, p.z);
      // An iron post with a scrolled arm.
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.07, 2.0, 8).translate(0, 1.0, 0), iron);
      post.position.copy(p);
      post.castShadow = true;
      g.add(post);
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.2, 8), iron);
      foot.position.set(p.x, p.y + 0.1, p.z);
      g.add(foot);
      this.lantern(new THREE.Vector3(p.x, p.y + 2.0, p.z), glowTex, brass, rnd, true);
    }
    // The lanterns nearest water also streak across it.
    const waterAt = [...castles.map((c) => c.position), new THREE.Vector3(0, 0, 1.4)];
    const near = this.lanternGlows
      .map((l) => l.s.position)
      .sort((a, b) => Math.min(...waterAt.map((w) => w.distanceTo(a))) - Math.min(...waterAt.map((w) => w.distanceTo(b))))
      .slice(0, MAX_GLINTS);
    near.forEach((p, i) => this.water.glints.value[i]!.copy(p));
    this.water.glintCount.value = near.length;

    // ── Vegetation ──
    const allowed = (x: number, z: number, pad = 0) => {
      for (const c of castles) if (Math.hypot(x - c.position.x, z - c.position.z) < MOAT.outer + 1.4 + pad) return false;
      if (Math.abs(x) < 5.5 + pad && z > -9.5 && z < 15) return false; // the garden, the arch and the plaza
      if (z > 13 && Math.abs(x) < 9 + (z - 13) * 1.1) return false; // keep the view open toward the camera
      for (const path of this.paths) for (const p of path) if (Math.hypot(p.x - x, p.z - z) < 1.6 + pad) return false;
      if (Math.hypot(x - FALLS_POOL.x, z - FALLS_POOL.z) < FALLS_POOL.r + 2.5) return false;
      if (Math.hypot(x - LIGHTHOUSE.x, z - LIGHTHOUSE.z) < 13) return false;
      return true;
    };
    const kinds: Record<TreeKind, Place[]> = { oak: [], olive: [], pine: [], cypress: [], palm: [] };
    const nTrees = hi ? 230 : 95;
    let placed = 0;
    for (let tries = 0; placed < nTrees && tries < 8000; tries++) {
      const x = (rnd() - 0.5) * 170;
      const z = 30 - rnd() * 135;
      if (!allowed(x, z, 0.6)) continue;
      const open = Math.abs(x) < 18 && z > -16;
      if (open && rnd() > 0.12) continue;
      // Pines up the slopes and far back, oaks in the valley, olives near the garden.
      const far = -z > 30 || Math.abs(x) > 40;
      const kind: TreeKind = far ? (rnd() < 0.75 ? 'pine' : 'oak') : Math.abs(x) < 22 && z > -20 && rnd() < 0.45 ? 'olive' : rnd() < 0.55 ? 'oak' : 'pine';
      kinds[kind].push({ x, z, rot: rnd() * 6.28, s: 0.85 + rnd() * 0.4 + Math.max(0, -z - 20) / 70 });
      placed++;
    }
    for (let z = -3.6; z <= 6.4; z += 2.5) for (const x of [-2.35, 2.35]) kinds.cypress.push({ x, z, rot: rnd() * 6, s: 0.9 + rnd() * 0.15 });
    for (const c of castles)
      for (const [lx, lz] of [
        [-6.2, -8.4],
        [6.2, -8.4],
        [-9.2, 2.6],
        [9.2, 2.6],
      ] as const) {
        const p = local(c, lx, lz);
        if (allowed(p.x, p.z, -0.8)) kinds.cypress.push({ x: p.x, z: p.z, rot: rnd() * 6, s: 1 + rnd() * 0.15 });
      }
    kinds.palm.push(
      { x: -3.5, z: -5.4, rot: 2.2, s: 1 },
      { x: 3.6, z: -5.2, rot: 0.9, s: 1.08 },
      { x: -4.1, z: -1.6, rot: 2.8, s: 0.92 },
      { x: 4.1, z: -1.2, rot: 0.3, s: 1 },
      { x: -4.6, z: 3.4, rot: 3.1, s: 0.86 },
      { x: 4.7, z: 3.8, rot: 0.1, s: 0.95 },
      { x: FALLS_POOL.x - 6.5, z: FALLS_POOL.z - 1, rot: 1.4, s: 1.1 },
      { x: FALLS_POOL.x + 6, z: FALLS_POOL.z + 1.5, rot: 0.2, s: 1 },
    );
    for (const kind of Object.keys(kinds) as TreeKind[]) this.forest(kind, kinds[kind], hi, time);

    // Grass: clumps everywhere the land is open, denser and taller toward the woods; none on the water or roads.
    const grassGeo = grassClump(hi ? 9 : 6, 0.5);
    const tallGeo = grassClump(hi ? 7 : 5, 0.95);
    const grassMat = windy(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.9 }), { bend: 0.55, flutter: 0.012, time, key: 'grass' });
    const nGrass = hi ? 9000 : 2400;
    const grass = new THREE.InstancedMesh(grassGeo, grassMat, nGrass);
    const tall = new THREE.InstancedMesh(tallGeo, grassMat, Math.round(nGrass / 4));
    const flowers: THREE.Matrix4[] = [];
    const flowerCols: THREE.Color[] = [];
    const fcols = ['#f5d0fe', '#fde68a', '#bae6fd', '#fecdd3', '#ffffff', '#c4b5fd'];
    const c = new THREE.Color();
    let n = 0;
    let nt = 0;
    const gardenOk = (x: number, z: number) => Math.abs(x) < 5.5 && z > -9 && z < 15 && Math.abs(x) > 1.65 && Math.hypot(x, z - 10.5) > 3.6 && Math.hypot(x, z + 7.2) > 2.6;
    for (let tries = 0; (n < nGrass || nt < tall.count) && tries < nGrass * 8; tries++) {
      const r = 6 + Math.pow(rnd(), 0.75) * 42;
      const a = rnd() * Math.PI * 2;
      const x = Math.cos(a) * r * 1.35;
      const z = Math.sin(a) * r - 3;
      const y = heightAt(x, z);
      if (y < MOAT_Y + 0.08) continue;
      let ok = allowed(x, z, -0.9) || gardenOk(x, z);
      if (!ok) {
        // Grass also grows on the moats' outer banks.
        for (const cc of castles) {
          const rr = Math.hypot(x - cc.position.x, z - cc.position.z);
          if (rr > MOAT.outer - 0.2 && rr < MOAT.outer + 2.2) ok = true;
        }
        for (const path of this.paths) for (const p of path) if (Math.hypot(p.x - x, p.z - z) < 1.05) ok = false;
      }
      if (!ok) continue;
      const patch = Math.sin(x * 0.31) * Math.cos(z * 0.27) + Math.sin(x * 0.11 + z * 0.17);
      if (patch < -0.9 && rnd() < 0.7) continue; // bare patches
      const s = 0.75 + rnd() * 0.7;
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y - 0.02, z), new THREE.Quaternion().setFromEuler(new THREE.Euler((rnd() - 0.5) * 0.2, rnd() * 6.28, (rnd() - 0.5) * 0.2)), new THREE.Vector3(s, s * (0.8 + rnd() * 0.5), s));
      c.setHSL(0.26 + rnd() * 0.08 + (patch > 0.8 ? 0.04 : 0), 0.35 + rnd() * 0.25, 0.42 + rnd() * 0.25);
      if (patch > 0.6 && nt < tall.count) {
        tall.setMatrixAt(nt, m);
        tall.setColorAt(nt++, c);
      } else if (n < nGrass) {
        grass.setMatrixAt(n, m);
        grass.setColorAt(n++, c);
      }
      if (rnd() < 0.035) {
        flowers.push(new THREE.Matrix4().makeTranslation(x + 0.08, y + 0.32 * s, z));
        flowerCols.push(new THREE.Color(fcols[Math.floor(rnd() * fcols.length)]!));
      }
    }
    grass.count = n;
    tall.count = nt;
    for (const m of [grass, tall]) {
      m.receiveShadow = true;
      g.add(m);
    }
    const fl = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.055, 0), this.flowerMat, flowers.length);
    flowers.forEach((m, i) => {
      fl.setMatrixAt(i, m);
      fl.setColorAt(i, flowerCols[i]!);
    });
    g.add(fl);
    // Reeds on the banks.
    const reed = reedClump();
    const reedMat = windy(new THREE.MeshStandardMaterial({ color: '#6f8a58', roughness: 0.8 }), { bend: 0.25, flutter: 0.01, time, key: 'reed' });
    const reedHeadMat = windy(new THREE.MeshStandardMaterial({ color: '#5a3a24', roughness: 0.9 }), { bend: 0.25, flutter: 0.01, time, key: 'reedh' });
    this.instance(reed.blades, reedMat, reedSpots, false);
    this.instance(reed.heads, reedHeadMat, reedSpots, false);
    // Shrubs along the roads and the garden's edges, half of them in bloom.
    const shrubSpots: [Place[], Place[]] = [[], []];
    for (const path of this.paths)
      for (let i = 1; i < path.length - 1; i += 3) {
        const a = path[i]!;
        const b = path[i + 1]!;
        const nn = new THREE.Vector3(-(b.z - a.z), 0, b.x - a.x).normalize().multiplyScalar((rnd() < 0.5 ? -1 : 1) * (1.6 + rnd() * 0.6));
        const p = a.clone().add(nn);
        if (p.distanceTo(plaza) < 3.9 || this.lanternGlows.some((l) => Math.hypot(l.s.position.x - p.x, l.s.position.z - p.z) < 0.8)) continue;
        if (castles.some((cc) => Math.hypot(p.x - cc.position.x, p.z - cc.position.z) < MOAT.outer + 0.4)) continue;
        shrubSpots[rnd() < 0.5 ? 1 : 0].push({ x: p.x, z: p.z, rot: rnd() * 6, s: 0.8 + rnd() * 0.6 });
      }
    for (const z of [-2.8, 0.2, 3.2, 5.6]) for (const x of [-3.2, 3.2]) shrubSpots[1].push({ x, z, rot: rnd() * 6, s: 0.7 + rnd() * 0.3 });
    for (const [k, list] of shrubSpots.entries()) {
      const sh = shrub(300 + k, k === 1);
      const mat = windy(new THREE.MeshStandardMaterial({ map: sh.tex, alphaTest: 0.45, alphaToCoverage: true, side: THREE.DoubleSide, color: '#c6d6bc', roughness: 0.85, emissive: '#0c1a10', emissiveIntensity: 0.4 }), { bend: 0.12, flutter: 0.015, time, key: `shrub${k}` });
      const im = this.instance(sh.geo, mat, list, hi);
      im.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: sh.tex, alphaTest: 0.45 });
    }
    // Boulders in natural groups across the land.
    for (let i = 0; i < (hi ? 26 : 12); i++) {
      const x = (rnd() - 0.5) * 120;
      const z = 22 - rnd() * 85;
      if (allowed(x, z, 1)) outcrop(x, z, 0.5 + rnd() * 1.3);
    }
    for (let i = 0; i < (hi ? 50 : 20); i++) {
      const x = (rnd() - 0.5) * 90;
      const z = 22 - rnd() * 70;
      if (allowed(x, z, 0.3)) rock(x, z, 0.12 + rnd() * 0.3, 0.55);
    }

    // ── The waterfall: a stratified cliff, the falls, its plunge pool, mist and spray ──
    const fx = FALLS.x;
    const fz = FALLS.z;
    const cliffGeo = rockGeometry(7, hi ? 4 : 3, true);
    const base = heightAt(fx, fz - 6);
    const cliff: [number, number, number, number, number][] = [
      [fx - 4.4, 4, fz - 4.4, 6, 0.3],
      [fx + 4.6, 3.6, fz - 4.8, 5.6, 1.1],
      [fx - 0.3, 8.5, fz - 6.8, 6.4, 2.2],
      [fx - 6.6, 8.6, fz - 7.6, 5.4, 0.9],
      [fx + 6.4, 7.8, fz - 7.6, 5.8, 1.7],
      [fx - 3, 12.6, fz - 9, 4.6, 2.6],
      [fx + 3.2, 12.2, fz - 9.4, 4.4, 0.5],
      [fx, 15.4, fz - 11, 4, 1.3],
      [fx - 9, 3.2, fz - 1.2, 3.4, 2.9],
      [fx + 9, 3.0, fz - 1.8, 3.1, 0.2],
      [fx - 11.5, 6.5, fz - 6, 4.6, 1.9],
      [fx + 11.5, 6, fz - 6.4, 4.4, 2.4],
    ];
    const cliffMesh = new THREE.InstancedMesh(cliffGeo, rockMat, cliff.length);
    cliff.forEach(([x, y, z, s, r], i) => cliffMesh.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(x, y + base - 1, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r, 0)), new THREE.Vector3(s, s * 1.15, s * 0.95))));
    cliffMesh.receiveShadow = true;
    cliffMesh.castShadow = hi;
    g.add(cliffMesh);
    // Ivy and ferns hanging in the cliff's ledges.
    const ivy = shrub(410, false);
    const ivySpots: Place[] = [];
    for (let i = 0; i < 26; i++) {
      const [x, y, z, s] = cliff[i % cliff.length]!;
      const a = rnd() * Math.PI - Math.PI;
      ivySpots.push({ x: x + Math.cos(a) * s * 0.7, z: z + Math.abs(Math.sin(a)) * s * 0.6 + 1, rot: rnd() * 6, s: 0.8 + rnd() * 0.8 });
      ivySpots[ivySpots.length - 1]!.rot = y; // carried in rot: the ledge height
    }
    const ivyMat = windy(new THREE.MeshStandardMaterial({ map: ivy.tex, alphaTest: 0.45, alphaToCoverage: true, side: THREE.DoubleSide, color: '#a9c49a', roughness: 0.85 }), { bend: 0.1, flutter: 0.02, time, key: 'ivy' });
    const ivyMesh = new THREE.InstancedMesh(ivy.geo, ivyMat, ivySpots.length);
    ivySpots.forEach((p, i) => ivyMesh.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(p.x, base - 1 + p.rot + (rnd() - 0.5) * 3, p.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() - 0.5, rnd() * 6, 0)), new THREE.Vector3(p.s!, p.s! * 1.4, p.s!))));
    g.add(ivyMesh);
    const poolY = fallsPoolY();
    const fallsTop = 15.5 + base - 1;
    const falls = new THREE.Mesh(new THREE.PlaneGeometry(3, fallsTop - poolY, 1, 16), fallsMaterial(this.water));
    const fpos = falls.geometry.attributes.position as THREE.BufferAttribute;
    const H = fallsTop - poolY;
    for (let i = 0; i < fpos.count; i++) {
      const v = (fpos.getY(i) + H / 2) / H;
      // Water leaves the lip in an arc, then drops nearly straight.
      fpos.setZ(i, Math.sqrt(Math.max(0, 1 - v)) * 0.2 + (v > 0.85 ? (v - 0.85) * 4 : 0) * -0.4 + Math.sin(v * Math.PI) * 0.9);
    }
    falls.position.set(fx, poolY + H / 2, fz - 3.6);
    g.add(falls);
    this.waterMeshes.push(falls);
    const fpGeo = new THREE.CircleGeometry(FALLS_POOL.r + 0.6, 48, 0, Math.PI * 2).rotateX(-Math.PI / 2);
    // Subdivide by rebuilding as a ring + centre so depth varies across it.
    const fpRing = new THREE.RingGeometry(0.01, FALLS_POOL.r + 0.6, 48, 8).rotateX(-Math.PI / 2);
    fpGeo.dispose();
    bakeDepth(fpRing, poolY, heightAt, new THREE.Vector3(FALLS_POOL.x, 0, FALLS_POOL.z));
    const fpool = new THREE.Mesh(fpRing, waterMaterial(this.water, { deep: '#0a1a40', shallow: '#3a8a8a', amp: 2.5, flow: [0, 1] }));
    fpool.position.set(FALLS_POOL.x, poolY, FALLS_POOL.z);
    fpool.renderOrder = 2;
    g.add(fpool);
    this.waterMeshes.push(fpool);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + rnd() * 0.3;
      rock(FALLS_POOL.x + Math.cos(a) * (FALLS_POOL.r + 0.3), FALLS_POOL.z + Math.sin(a) * (FALLS_POOL.r + 0.3), 0.5 + rnd() * 0.8, 0.6, 0.3);
    }
    this.fallsBase.set(fx, poolY + 0.2, fz - 3);

    // ── The lighthouse on its hill, with a village at its foot ──
    const lx = LIGHTHOUSE.x;
    const lz = LIGHTHOUSE.z;
    const hillY = heightAt(lx, lz);
    const hillGeo = rockGeometry(9, hi ? 4 : 3, true);
    const hill = new THREE.Mesh(hillGeo, rockMat);
    hill.scale.set(15, 7, 14);
    hill.position.set(lx, hillY - 1, lz);
    hill.receiveShadow = true;
    g.add(hill);
    const top = hillY - 1 + 5.6;
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.7, 16, 24), new THREE.MeshStandardMaterial({ color: '#e2dcec', roughness: 0.7 }));
    tower.position.set(lx, top + 8, lz);
    g.add(tower);
    const bandMat = new THREE.MeshStandardMaterial({ color: '#8a2c3e', roughness: 0.7 });
    for (const y of [3, 7.5, 12]) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(1.7 - (y / 16) * 0.6 + 0.03, 1.7 - ((y - 1.2) / 16) * 0.6 + 0.03, 1.2, 24), bandMat);
      b.position.set(lx, top + y, lz);
      g.add(b);
    }
    const gallery = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.3, 0.4, 24), marble);
    gallery.position.set(lx, top + 16.2, lz);
    g.add(gallery);
    this.beamLamp = new THREE.MeshBasicMaterial({ color: '#fff1c4', toneMapped: false });
    const lampRoom = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.4, 16), this.beamLamp);
    lampRoom.position.set(lx, top + 17.1, lz);
    g.add(lampRoom);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.05, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), gold);
    dome.position.set(lx, top + 17.8, lz);
    g.add(dome);
    const lglow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffe2a0', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9 }));
    lglow.scale.setScalar(9);
    lglow.position.set(lx, top + 17.1, lz);
    g.add(lglow);
    this.beam = new THREE.Group();
    this.beam.position.set(lx, top + 17.1, lz);
    const beamMat = new THREE.ShaderMaterial({
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
      fragmentShader: 'varying vec2 vUv; void main(){ float a = pow(vUv.y, 2.2) * 0.14 * (0.6 + 0.4 * sin(vUv.x * 6.2831)); gl_FragColor = vec4(1., 0.92, 0.7, a); }',
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
    const houseGeo = new THREE.BoxGeometry(1.6, 1.2, 1.3).translate(0, 0.6, 0);
    const houseRoof = new THREE.ConeGeometry(1.25, 0.8, 4).rotateY(Math.PI / 4).translate(0, 1.6, 0);
    const winGeo = mergeGeometries([new THREE.PlaneGeometry(0.22, 0.3).translate(-0.4, 0.65, 0.66), new THREE.PlaneGeometry(0.22, 0.3).translate(0.35, 0.65, 0.66)])!;
    const houses: Place[] = [];
    for (let i = 0; i < 14; i++) {
      const a = -2.6 + (i / 13) * 2.2 + rnd() * 0.15;
      const r = 9 + rnd() * 6;
      houses.push({ x: lx + Math.cos(a) * r, z: lz + 14 + Math.sin(a) * r * 0.5, rot: rnd() * 0.8 - 0.4 });
    }
    this.instance(houseGeo, new THREE.MeshStandardMaterial({ color: '#c9b8a6', roughness: 0.9 }), houses, false);
    this.instance(houseRoof, new THREE.MeshStandardMaterial({ color: '#8a4436', roughness: 0.8, flatShading: true }), houses, false);
    this.instance(winGeo, this.lanternMat, houses, false);

    // Rocks: every boulder and stone gathered above, in three shapes.
    rocks.forEach((list, k) => {
      if (!list.length) return;
      const m = new THREE.InstancedMesh(rockGeos[k]!, rockMat, list.length);
      list.forEach((x, i) => m.setMatrixAt(i, x));
      m.castShadow = hi;
      m.receiveShadow = true;
      g.add(m);
    });

    // ── Sky: clouds, a low mist and a shooting star ──
    const cloudTex = softTexture(0.25);
    for (let i = 0; i < (hi ? 18 : 9); i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, color: new THREE.Color('#5a4c9c').offsetHSL(0, 0, rnd() * 0.08), transparent: true, opacity: 0.2 + rnd() * 0.2, depthWrite: false, fog: false }));
      s.position.set((rnd() - 0.5) * 300, 40 + rnd() * 34, -120 - rnd() * 60);
      s.scale.set(50 + rnd() * 60, 12 + rnd() * 10, 1);
      g.add(s);
      this.clouds.push({ s, v: 0.6 + rnd() * 0.9 });
    }
    for (let i = 0; i < (hi ? 12 : 6); i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, color: '#8a84c4', transparent: true, opacity: 0.08 + rnd() * 0.07, depthWrite: false }));
      s.position.set((rnd() - 0.5) * 140, 1.2 + rnd() * 2.5, -22 - rnd() * 45);
      s.scale.set(30 + rnd() * 30, 3.5 + rnd() * 3, 1);
      g.add(s);
      this.clouds.push({ s, v: 0.3 + rnd() * 0.4 });
    }
    this.star = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffffff', blending: THREE.AdditiveBlending, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    this.star.scale.set(6, 0.25, 1);
    g.add(this.star);

    // ── Fireflies, birds ──
    const nf = hi ? 110 : 45;
    this.flyBase = new Float32Array(nf * 4);
    for (let i = 0; i < nf; i++) {
      const garden = i % 3 === 0;
      const x = garden ? (rnd() - 0.5) * 9 : (rnd() < 0.5 ? -1 : 1) * (15 + rnd() * 14);
      const z = garden ? -6 + rnd() * 18 : -14 + rnd() * 24;
      this.flyBase.set([x, Math.max(heightAt(x, z), POOL_Y) + 0.4 + rnd() * 1.8, z, rnd() * 100], i * 4);
    }
    const fgeo = new THREE.BufferGeometry();
    fgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nf * 3), 3));
    fgeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(nf * 3), 3));
    this.fireflies = new THREE.Points(fgeo, new THREE.PointsMaterial({ size: 0.22, map: glowTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.fireflies.frustumCulled = false;
    g.add(this.fireflies);
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

    // Water particles: the fountain's spray, the waterfall's mist and splash.
    this.spray = new Particles(hi ? 700 : 280, softTexture(0.4), { additive: true });
    this.mist = new Particles(hi ? 320 : 140, softTexture(0.1));
    g.add(this.mist.points, this.spray.points);
  }

  /** An Arabic brass lantern (fanoos): a six-sided pierced body, a domed cap with a finial, warm glass. */
  private lantern(at: THREE.Vector3, glow: THREE.Texture, brass: THREE.Material, rnd: () => number, ground: boolean) {
    const g = new THREE.Group();
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.3, 6), this.lanternMat);
    glass.position.y = 0.2;
    g.add(glass);
    const frame = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.13, 0.32, 6, 1, true), new THREE.MeshStandardMaterial({ color: '#b78a3a', metalness: 0.85, roughness: 0.4, wireframe: true }));
    frame.position.y = 0.2;
    g.add(frame);
    const capG = new THREE.SphereGeometry(0.16, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    const cap = new THREE.Mesh(capG, brass);
    cap.position.y = 0.35;
    g.add(cap);
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.16, 6), brass);
    fin.position.y = 0.55;
    g.add(fin);
    const bottom = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.1, 6).rotateX(Math.PI), brass);
    bottom.position.y = 0.0;
    g.add(bottom);
    g.position.copy(at);
    g.castShadow = true;
    this.group.add(g);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: '#ffb060', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.4 }));
    s.position.set(at.x, at.y + 0.2, at.z);
    s.scale.setScalar(0.9);
    this.group.add(s);
    this.lanternGlows.push({ s, base: 0.4, ph: rnd() * 10 });
    if (ground) {
      const gy = heightAt(at.x, at.z);
      const pool = new THREE.Mesh(new THREE.CircleGeometry(1.6, 24), new THREE.MeshBasicMaterial({ map: glow, color: '#ff9a4a', transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false }));
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(at.x, Math.max(gy, MOAT_Y) + 0.07, at.z);
      this.group.add(pool);
    }
  }

  /** A freestanding Moorish horseshoe arch: two marble columns with capitals, red and cream voussoirs, a carved band,
   *  a hanging lantern under the keystone. It closes the pool's axis and doubles in its water. */
  private arch(at: THREE.Vector3, stone: THREE.Material, marble: THREE.Material, gold: THREE.Material, glow: THREE.Texture, brass: THREE.Material, rnd: () => number) {
    const g = new THREE.Group();
    const W = 2.4;
    const colH = 2.4;
    for (const sx of [-1, 1]) {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(0.7, 3.4, 0.7), stone);
      pier.position.set(sx * (W / 2 + 0.55), 1.7, 0);
      pier.castShadow = pier.receiveShadow = true;
      g.add(pier);
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, colH, 16), marble);
      col.position.set(sx * (W / 2 - 0.02), colH / 2 + 0.2, 0.34);
      col.castShadow = true;
      g.add(col);
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.2, 0.36), marble);
      base.position.set(sx * (W / 2 - 0.02), 0.1, 0.34);
      g.add(base);
      const capital = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.14, 0.26, 4).rotateY(Math.PI / 4), marble);
      capital.position.set(sx * (W / 2 - 0.02), colH + 0.33, 0.34);
      g.add(capital);
    }
    // Voussoirs round a horseshoe (more than a half circle), alternating red brick and cream stone.
    const R = W / 2 + 0.05;
    const cy = colH + 0.55;
    const red = new THREE.MeshStandardMaterial({ color: '#9a3b2f', roughness: 0.8 });
    const cream = new THREE.MeshStandardMaterial({ color: '#e6d8bf', roughness: 0.7 });
    const n = 17;
    const a0 = -0.35;
    const a1 = Math.PI + 0.35;
    for (let i = 0; i < n; i++) {
      const a = a0 + ((a1 - a0) * (i + 0.5)) / n;
      const v = new THREE.Mesh(new THREE.BoxGeometry(0.5, ((a1 - a0) / n) * (R + 0.25) * 0.96, 0.62), i % 2 ? red : cream);
      v.position.set(Math.cos(a) * (R + 0.25), cy + Math.sin(a) * (R + 0.25), 0.1);
      v.rotation.z = a;
      v.castShadow = true;
      g.add(v);
    }
    // The wall above (alfiz frame) with a gold band and an eight-pointed star inlay.
    const alfiz = new THREE.Mesh(new THREE.BoxGeometry(W + 2.3, 0.9, 0.7), stone);
    alfiz.position.set(0, cy + R + 0.9, 0);
    alfiz.castShadow = true;
    g.add(alfiz);
    for (const y of [cy + R + 0.42, cy + R + 1.37]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(W + 2.35, 0.06, 0.74), gold);
      band.position.set(0, y, 0);
      g.add(band);
    }
    const star = new THREE.Shape();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const r = i % 2 ? 0.17 : 0.3;
      if (i) star.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      else star.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    for (const z of [0.36, -0.36]) {
      const s = new THREE.Mesh(new THREE.ShapeGeometry(star), gold);
      s.position.set(0, cy + R + 0.9, z);
      if (z < 0) s.rotation.y = Math.PI;
      g.add(s);
    }
    // Merlons along the top, stepped in the Andalusian way.
    for (let i = -3; i <= 3; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.5), stone);
      m.position.set(i * 0.66, cy + R + 1.55, 0);
      g.add(m);
    }
    g.position.copy(at);
    g.position.y = heightAt(at.x, at.z);
    this.group.add(g);
    // A lantern hanging on a chain under the keystone.
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.7, 4), brass);
    chain.position.set(at.x, g.position.y + cy + R - 0.35, at.z + 0.1);
    this.group.add(chain);
    this.lantern(new THREE.Vector3(at.x, g.position.y + cy + R - 1.25, at.z + 0.1), glow, brass, rnd, false);
  }

  /** Plants one kind of tree at its places, spreading the three variants among them. */
  private forest(kind: TreeKind, places: Place[], hi: boolean, time: { value: number }) {
    if (!places.length) return;
    const kit = treeKit(kind, time);
    kit.variants.forEach((v, k) => {
      const list = places.filter((_, i) => i % 3 === k);
      if (!list.length) return;
      this.instance(v.wood, kit.wood, list, hi);
      const leaves = this.instance(v.leaves, kit.leaves, list, hi);
      leaves.customDepthMaterial = kit.depth;
      if (v.dates && kit.dates) this.instance(v.dates, kit.dates, list, false);
    });
  }

  private instance(geo: THREE.BufferGeometry, mat: THREE.Material, list: Place[], cast: boolean) {
    const m = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((p, i) => {
      const s = p.s ?? 1;
      m.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(p.x, heightAt(p.x, p.z) - 0.04, p.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, p.rot, 0)), new THREE.Vector3(s, s * (0.92 + ((i * 7) % 5) * 0.04), s)));
    });
    m.castShadow = cast;
    m.receiveShadow = true;
    this.group.add(m);
    return m;
  }

  private addLight(at: THREE.Vector3, color = '#ffb060', k = 1) {
    const l = new THREE.PointLight(color, 9 * k, 10, 2);
    l.position.copy(at);
    this.group.add(l);
    this.lights.push({ l, base: 9 * k });
  }

  /** A cobbled road along a curve: a ribbon laid on the ground, rounded at the edges. */
  private road(curve: THREE.CatmullRomCurve3, width: number, mat: THREE.Material) {
    const n = Math.max(12, Math.round(curve.getLength() * 2.5));
    const pts = curve.getSpacedPoints(n);
    this.paths.push(pts);
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    let along = 0;
    const across = [-1, -0.85, 0, 0.85, 1];
    pts.forEach((p, i) => {
      const a = pts[Math.max(0, i - 1)]!;
      const b = pts[Math.min(n, i + 1)]!;
      const t = b.clone().sub(a).normalize();
      const nrm = new THREE.Vector3(-t.z, 0, t.x);
      if (i) along += p.distanceTo(pts[i - 1]!);
      for (const s of across) {
        const q = p.clone().addScaledVector(nrm, (s * width) / 2);
        // Slightly crowned in the middle, tucked into the ground at the edges.
        pos.push(q.x, heightAt(q.x, q.z) + 0.04 + (1 - s * s) * 0.03 - (Math.abs(s) === 1 ? 0.03 : 0), q.z);
        uv.push(((s + 1) / 2) * (width / 2), along / 2);
      }
      if (i < n)
        for (let k = 0; k < across.length - 1; k++) {
          const o = i * across.length + k;
          idx.push(o, o + 1, o + across.length, o + 1, o + across.length + 1, o + across.length);
        }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    // The normal map needs tangents' worth of orientation; flip the winding if it came out facing down.
    const ny = (geo.attributes.normal as THREE.BufferAttribute).getY(0);
    if (ny < 0) {
      geo.setIndex(idx.map((_, i) => idx[i - (i % 3) + 2 - (i % 3)]!));
      geo.computeVertexNormals();
    }
    const m = new THREE.Mesh(geo, mat);
    m.receiveShadow = true;
    this.group.add(m);
  }

  /** Re-takes the scene capture used by the water and as soft ambient light. Cheap enough to do every few seconds. */
  capture(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
    for (const w of this.waterMeshes) w.visible = false;
    this.cube.update(renderer, scene);
    for (const w of this.waterMeshes) w.visible = true;
    this.water.hasEnv.value = 1;
    this.pmrem ??= new THREE.PMREMGenerator(renderer);
    const next = this.pmrem.fromCubemap(this.cubeRT.texture);
    scene.environment = next.texture;
    this.envRT?.dispose();
    this.envRT = next;
  }

  /** One frame of the world's life. `wind` lifts while a question runs. Returns true when the capture should be re-taken. */
  update(t: number, dt: number, wind: number) {
    this.time.value = t * (0.9 + wind * 0.2);
    for (const l of this.lanternGlows) {
      const f = 0.85 + Math.sin(t * 7.3 + l.ph) * 0.06 + Math.sin(t * 13.1 + l.ph * 2) * 0.05 + (Math.random() - 0.5) * 0.05;
      (l.s.material as THREE.SpriteMaterial).opacity = l.base * f;
      l.s.scale.setScalar(0.9 * (0.95 + f * 0.08));
    }
    this.lanternMat.emissiveIntensity = 2.1 + Math.sin(t * 9.1) * 0.15 + Math.sin(t * 17.3) * 0.1;
    for (const [i, { l, base }] of this.lights.entries()) l.intensity = base * (0.9 + Math.sin(t * 8 + i * 3) * 0.06 + Math.random() * 0.05);
    this.runeMat.emissiveIntensity = 0.55 + Math.sin(t * 1.4) * 0.3;
    this.flowerMat.emissiveIntensity = 0.38 + Math.sin(t * 0.9) * 0.14;
    for (const c of this.clouds) {
      c.s.position.x += c.v * dt * (0.8 + wind * 0.4);
      if (c.s.position.x > 160) c.s.position.x = -160;
    }
    this.beam.rotation.y = t * 0.45;
    this.beamLamp.color.setScalar(0.9 + Math.sin(t * 3) * 0.08);
    const fp = this.fireflies.geometry.attributes.position as THREE.BufferAttribute;
    const fc = this.fireflies.geometry.attributes.color as THREE.BufferAttribute;
    for (let i = 0; i < fp.count; i++) {
      const x = this.flyBase[i * 4]!;
      const y = this.flyBase[i * 4 + 1]!;
      const z = this.flyBase[i * 4 + 2]!;
      const ph = this.flyBase[i * 4 + 3]!;
      fp.setXYZ(i, x + Math.sin(t * 0.4 + ph) * 1.4 + Math.sin(t * 1.3 + ph * 2) * 0.3, y + Math.sin(t * 0.7 + ph * 3) * 0.5, z + Math.cos(t * 0.35 + ph) * 1.4);
      const b = Math.max(0, Math.sin(t * 1.6 + ph * 7)) ** 3;
      fc.setXYZ(i, 0.85 * b, 1.0 * b, 0.45 * b);
    }
    fp.needsUpdate = true;
    fc.needsUpdate = true;
    for (const b of this.birds) {
      const a = t * b.sp + b.ph;
      b.g.position.set(LIGHTHOUSE.x + Math.cos(a) * b.r, b.h + Math.sin(a * 2) * 0.8, LIGHTHOUSE.z + Math.sin(a) * b.r * 0.6);
      b.g.rotation.y = -a;
      const flap = Math.sin(t * 9 + b.ph) * (Math.sin(t * 0.7 + b.ph) > 0 ? 0.7 : 0.15);
      b.wings[0].rotation.z = flap;
      b.wings[1].rotation.z = -flap;
    }
    this.starT -= dt;
    const sm = this.star.material as THREE.SpriteMaterial;
    if (this.starT <= 0) {
      this.starT = 9 + Math.random() * 14;
      this.star.position.set(-60 + Math.random() * 120, 60 + Math.random() * 20, -150);
      this.starV.set(-28 - Math.random() * 18, -10, 0);
      sm.rotation = Math.atan2(this.starV.y, this.starV.x);
      sm.opacity = 1;
    }
    if (sm.opacity > 0) {
      this.star.position.addScaledVector(this.starV, dt);
      sm.opacity = Math.max(0, sm.opacity - dt * 1.4);
    }
    const k = this.tier === 'high' ? 1 : 0.5;
    for (let i = 0; i < 3 * k; i++) {
      const a = Math.random() * Math.PI * 2;
      this.spray.emit(this.fountainTop, new THREE.Vector3(Math.cos(a) * 0.5, 2.4 + Math.random() * 0.6, Math.sin(a) * 0.5), { life: 1.1, size: 0.2, grow: -0.05, color: '#b8d4ff', alpha: 0.5, gravity: 6 });
    }
    if (Math.random() < 0.7 * k) {
      const a = Math.random() * Math.PI * 2;
      this.spray.emit(new THREE.Vector3(this.fountainTop.x + Math.cos(a) * 0.62, 1.55, this.fountainTop.z + Math.sin(a) * 0.62), new THREE.Vector3(Math.cos(a) * 0.4, 0.2, Math.sin(a) * 0.4), { life: 0.6, size: 0.15, color: '#a9c8ff', alpha: 0.45, gravity: 7 });
    }
    // The falls: a white splash at the foot, and mist rolling out over the pool.
    for (let i = 0; i < 2 * k; i++) {
      this.spray.emit(this.fallsBase.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2.4, 0, (Math.random() - 0.5) * 0.6)), new THREE.Vector3((Math.random() - 0.5) * 2, 2 + Math.random() * 2, 0.5 + Math.random() * 1.5), { life: 0.9, size: 0.6, grow: 0.4, color: '#d8e4ff', alpha: 0.5, gravity: 5 });
    }
    if (Math.random() < 0.6 * k) {
      this.mist.emit(this.fallsBase.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2.4, 0.3, Math.random())), new THREE.Vector3((Math.random() - 0.5) * 1.2, 0.7 + Math.random() * 0.6, 0.8 + Math.random() * 0.8), { life: 3.4, size: 2.4, grow: 1.8, color: '#c9d2ff', alpha: 0.28, drag: 0.6 });
    }
    this.spray.update(dt);
    this.mist.update(dt);
    this.captureIn -= dt;
    if (this.captureIn <= 0) {
      this.captureIn = this.tier === 'high' ? 3 : 8;
      return true;
    }
    return false;
  }

  dispose() {
    this.cubeRT.dispose();
    this.envRT?.dispose();
    this.pmrem?.dispose();
  }
}
