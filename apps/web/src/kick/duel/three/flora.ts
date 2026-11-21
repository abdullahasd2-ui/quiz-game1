// Plants grown in code. Trees are real branching skeletons (tapered limbs that fork and bend, flared roots) clothed in
// alpha-cut leaf cards drawn on canvases: oak, olive, pine, cypress and date palm, three variants each so no two
// neighbours match. Leaf normals point out from the crown so a tree lights as one soft volume, and leaves throw cut-out
// shadows. Grass is curved blades in clumps, with reeds by the water, flowering shrubs and wild flowers.
// Everything sways: limbs from the base, leaves flutter on top.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const seeded = (seed: number) => {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
};

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D, rnd: () => number) => void, seed: number, color = true) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!, seeded(seed));
  const t = new THREE.CanvasTexture(c);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** A spray of leaves on a card: each leaf a pointed blade with a midrib and its own shade. */
function leafCard(kind: 'broad' | 'olive' | 'needle' | 'scale' | 'shrub' | 'bloom', seed: number) {
  return canvasTex(
    256,
    256,
    (g, rnd) => {
      g.clearRect(0, 0, 256, 256);
      if (kind === 'needle') {
        // Pine: a twig with needles fanning out along it.
        g.lineCap = 'round';
        for (let k = 0; k < 3; k++) {
          const x0 = 40 + k * 80 + rnd() * 20;
          g.strokeStyle = '#3b2a20';
          g.lineWidth = 3;
          g.beginPath();
          g.moveTo(x0, 250);
          g.lineTo(x0 + 10, 10);
          g.stroke();
          for (let y = 245; y > 15; y -= 5) {
            for (const s of [-1, 1]) {
              const l = 22 + rnd() * 18 - (245 - y) * 0.04;
              const sh = 30 + rnd() * 25;
              g.strokeStyle = `hsl(${150 + rnd() * 25}, ${35 + rnd() * 15}%, ${sh}%)`;
              g.lineWidth = 1.6;
              g.beginPath();
              const xx = x0 + ((250 - y) / 240) * 10;
              g.moveTo(xx, y);
              g.lineTo(xx + s * l, y - l * 0.7);
              g.stroke();
            }
          }
        }
        return;
      }
      const n = kind === 'scale' ? 160 : kind === 'olive' ? 70 : kind === 'shrub' || kind === 'bloom' ? 60 : 44;
      for (let i = 0; i < n; i++) {
        const x = 30 + rnd() * 196;
        const y = 30 + rnd() * 196;
        const a = rnd() * Math.PI * 2;
        const L = kind === 'scale' ? 10 + rnd() * 8 : kind === 'olive' ? 26 + rnd() * 14 : 22 + rnd() * 18;
        const W = kind === 'olive' ? L * 0.18 : kind === 'scale' ? L * 0.45 : L * 0.42;
        g.save();
        g.translate(x, y);
        g.rotate(a);
        const hue = kind === 'olive' ? 95 + rnd() * 20 : kind === 'scale' ? 150 + rnd() * 15 : 105 + rnd() * 40;
        const sat = kind === 'olive' ? 12 + rnd() * 10 : 30 + rnd() * 25;
        const lit = kind === 'olive' ? 48 + rnd() * 16 : 26 + rnd() * 24;
        const grad = g.createLinearGradient(-W, 0, W, 0);
        grad.addColorStop(0, `hsl(${hue}, ${sat}%, ${lit - 8}%)`);
        grad.addColorStop(0.5, `hsl(${hue}, ${sat}%, ${lit + 6}%)`);
        grad.addColorStop(1, `hsl(${hue}, ${sat}%, ${lit - 10}%)`);
        g.fillStyle = grad;
        g.beginPath();
        g.moveTo(0, -L / 2);
        g.quadraticCurveTo(W, -L * 0.1, 0, L / 2);
        g.quadraticCurveTo(-W, -L * 0.1, 0, -L / 2);
        g.fill();
        if (kind !== 'scale') {
          g.strokeStyle = 'rgba(20,30,10,0.45)';
          g.lineWidth = 1;
          g.beginPath();
          g.moveTo(0, -L / 2);
          g.lineTo(0, L / 2);
          g.stroke();
        }
        g.restore();
        if (kind === 'bloom' && rnd() < 0.55) {
          // Bougainvillea-like bracts: little clusters of magenta and pink.
          g.fillStyle = `hsl(${315 + rnd() * 30}, 75%, ${55 + rnd() * 15}%)`;
          for (let k = 0; k < 3; k++) {
            g.beginPath();
            g.arc(x + rnd() * 14 - 7, y + rnd() * 14 - 7, 4 + rnd() * 3, 0, Math.PI * 2);
            g.fill();
          }
        }
      }
    },
    seed,
  );
}

/** Bark: vertical fissures and plates; also its own bump map. */
export function barkTexture(light = false) {
  return canvasTex(
    128,
    256,
    (g, rnd) => {
      g.fillStyle = light ? '#8d8478' : '#4a3c34';
      g.fillRect(0, 0, 128, 256);
      for (let i = 0; i < 90; i++) {
        const x = rnd() * 128;
        g.strokeStyle = light ? `rgba(40,34,30,${0.3 + rnd() * 0.4})` : `rgba(15,10,8,${0.4 + rnd() * 0.4})`;
        g.lineWidth = 1 + rnd() * 3;
        g.beginPath();
        g.moveTo(x, 0);
        let xx = x;
        for (let y = 0; y <= 256; y += 16) g.lineTo((xx += rnd() * 6 - 3), y);
        g.stroke();
      }
      for (let i = 0; i < 400; i++) {
        g.fillStyle = `rgba(${rnd() > 0.5 ? '255,240,220' : '0,0,0'},${rnd() * 0.12})`;
        g.fillRect(rnd() * 128, rnd() * 256, 2 + rnd() * 3, 4 + rnd() * 10);
      }
    },
    light ? 91 : 90,
  );
}

/** A palm frond: a stiff midrib with long leaflets angled forward along it. */
function frondTexture() {
  return canvasTex(
    128,
    512,
    (g, rnd) => {
      g.clearRect(0, 0, 128, 512);
      g.lineCap = 'round';
      for (let y = 500; y > 10; y -= 7) {
        const k = (500 - y) / 490;
        const L = 56 * Math.sin(Math.min(1, k * 1.25) * Math.PI * 0.95) + 6;
        for (const s of [-1, 1]) {
          g.strokeStyle = `hsl(${110 + rnd() * 25}, ${32 + rnd() * 15}%, ${26 + rnd() * 18}%)`;
          g.lineWidth = 3.2 - k * 1.6;
          g.beginPath();
          g.moveTo(64, y);
          g.quadraticCurveTo(64 + s * L * 0.5, y - L * 0.35, 64 + s * L, y - L * 0.55 + rnd() * 6);
          g.stroke();
        }
      }
      g.strokeStyle = '#6b6a3a';
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(64, 512);
      g.lineTo(64, 6);
      g.stroke();
    },
    77,
  );
}

// ── Skeletons ───────────────────────────────────────────────────────────────

type Built = { wood: THREE.BufferGeometry; leaves: THREE.BufferGeometry };
const UP = new THREE.Vector3(0, 1, 0);

/** A tapered limb from a to b, slightly bowed. */
function limb(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number, bow: THREE.Vector3, seg = 6) {
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(r1, r0, len, seg, 3, true);
  g.translate(0, len / 2, 0);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getY(i) / len;
    const k = Math.sin(t * Math.PI);
    pos.setXYZ(i, pos.getX(i) + bow.x * k, pos.getY(i), pos.getZ(i) + bow.z * k);
  }
  // UVs: wrap once around, run the bark texture along the limb's length.
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * len * 0.6);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, b.clone().sub(a).normalize()));
  g.translate(a.x, a.y, a.z);
  return g.toNonIndexed();
}

/** Leaf cards round a point; their normals point out from the crown centre so the crown shades as one volume. */
function cards(out: THREE.BufferGeometry[], at: THREE.Vector3, crown: THREE.Vector3, n: number, size: number, spread: number, rnd: () => number, droop = 0) {
  for (let i = 0; i < n; i++) {
    const q = new THREE.PlaneGeometry(size * (0.8 + rnd() * 0.4), size * (0.8 + rnd() * 0.4));
    q.rotateX(-Math.PI / 2 + (rnd() - 0.5) * 1.6 - droop);
    q.rotateY(rnd() * Math.PI * 2);
    q.rotateZ((rnd() - 0.5) * 0.9);
    const p = at.clone().add(new THREE.Vector3((rnd() - 0.5) * 2, (rnd() - 0.5) * 1.3, (rnd() - 0.5) * 2).multiplyScalar(spread));
    q.translate(p.x, p.y, p.z);
    const nrm = q.attributes.normal as THREE.BufferAttribute;
    const posA = q.attributes.position as THREE.BufferAttribute;
    for (let k = 0; k < nrm.count; k++) {
      const v = new THREE.Vector3(posA.getX(k), posA.getY(k), posA.getZ(k)).sub(crown).normalize();
      v.y = v.y * 0.7 + 0.45;
      v.normalize();
      nrm.setXYZ(k, v.x, v.y, v.z);
    }
    out.push(q.toNonIndexed());
  }
}

/** Broadleaf (oak, olive): a trunk that forks into limbs, three levels deep, leaf clusters on the twigs. */
function broadleaf(seed: number, o: { h: number; r: number; spread: number; levels: number; leaf: number; cards: number; gnarl: number; twin?: boolean }): Built {
  const rnd = seeded(seed);
  const wood: THREE.BufferGeometry[] = [];
  const leaves: THREE.BufferGeometry[] = [];
  const crown = new THREE.Vector3(0, o.h + o.spread * 0.5, 0);
  // Root flare.
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + rnd();
    wood.push(limb(new THREE.Vector3(Math.cos(a) * o.r * 1.6, -0.05, Math.sin(a) * o.r * 1.6), new THREE.Vector3(0, o.h * 0.25, 0), o.r * 0.5, o.r * 0.6, new THREE.Vector3(0, 0, 0), 4));
  }
  const grow = (a: THREE.Vector3, dir: THREE.Vector3, len: number, r: number, depth: number) => {
    const b = a.clone().addScaledVector(dir, len);
    const bow = new THREE.Vector3((rnd() - 0.5) * o.gnarl * len, 0, (rnd() - 0.5) * o.gnarl * len);
    wood.push(limb(a, b, r, r * 0.62, bow, depth === 0 ? 8 : 5));
    if (depth >= o.levels) {
      cards(leaves, b, crown, o.cards, o.leaf, o.leaf * 0.9, rnd);
      return;
    }
    const kids = depth === 0 ? 3 + Math.floor(rnd() * 2) : 2 + Math.floor(rnd() * 2);
    for (let k = 0; k < kids; k++) {
      const yaw = (k / kids) * Math.PI * 2 + rnd() * 1.2;
      const pitch = (depth === 0 ? 0.75 : 0.55) + rnd() * 0.45;
      const d = new THREE.Vector3(Math.cos(yaw) * Math.sin(pitch), Math.cos(pitch), Math.sin(yaw) * Math.sin(pitch)).lerp(dir, 0.3).normalize();
      grow(b.clone().addScaledVector(dir, -len * rnd() * 0.25), d, len * (0.62 + rnd() * 0.15), r * 0.62, depth + 1);
    }
    // A few leaves along the inner limbs too, so the crown is never hollow.
    if (depth >= 1) cards(leaves, b, crown, Math.ceil(o.cards / 3), o.leaf, o.leaf * 0.6, rnd);
  };
  const trunks = o.twin ? 2 : 1;
  for (let t = 0; t < trunks; t++) {
    const lean = trunks > 1 ? (t ? 0.28 : -0.24) : (rnd() - 0.5) * 0.15;
    grow(new THREE.Vector3(0, 0, 0), new THREE.Vector3(Math.sin(lean), 1, rnd() * 0.1).normalize(), o.h, o.r, 0);
  }
  return { wood: mergeGeometries(wood)!, leaves: mergeGeometries(leaves)! };
}

/** Pine: a straight trunk with whorls of drooping limbs, needle cards along each, narrowing to a spire. */
function pine(seed: number): Built {
  const rnd = seeded(seed);
  const wood: THREE.BufferGeometry[] = [];
  const leaves: THREE.BufferGeometry[] = [];
  const H = 6 + rnd() * 2;
  wood.push(limb(new THREE.Vector3(0, -0.1, 0), new THREE.Vector3((rnd() - 0.5) * 0.3, H, (rnd() - 0.5) * 0.3), 0.24, 0.04, new THREE.Vector3((rnd() - 0.5) * 0.3, 0, 0), 8));
  const crown = new THREE.Vector3(0, H * 0.6, 0);
  for (let y = 1.4; y < H - 0.2; y += 0.42 + rnd() * 0.12) {
    const t = (y - 1.4) / (H - 1.6);
    const reach = (1 - t) * 2.2 + 0.35;
    const n = 4 + Math.floor(rnd() * 3);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + rnd() * 0.8 + y;
      const start = new THREE.Vector3(0, y, 0);
      const end = new THREE.Vector3(Math.cos(a) * reach, y - reach * 0.35, Math.sin(a) * reach);
      wood.push(limb(start, end, 0.05, 0.015, new THREE.Vector3(0, 0, 0), 3));
      for (let s = 0.35; s <= 1.0; s += 0.32) cards(leaves, start.clone().lerp(end, s).add(new THREE.Vector3(0, 0.12, 0)), crown, 2, 0.95 * (1 - t * 0.4), 0.18, rnd, 0.35);
    }
  }
  cards(leaves, new THREE.Vector3(0, H - 0.1, 0), crown, 4, 0.7, 0.15, rnd);
  return { wood: mergeGeometries(wood)!, leaves: mergeGeometries(leaves)! };
}

/** Italian cypress: a tall, tight flame of scale-leaf cards round a hidden stem. */
function cypress(seed: number): Built {
  const rnd = seeded(seed);
  const wood = [limb(new THREE.Vector3(0, -0.1, 0), new THREE.Vector3(0, 1.2, 0), 0.16, 0.12, new THREE.Vector3(0, 0, 0), 6)];
  const leaves: THREE.BufferGeometry[] = [];
  const H = 6.5 + rnd() * 1.5;
  const crown = new THREE.Vector3(0, H * 0.5, 0);
  for (let i = 0; i < 150; i++) {
    const y = 0.8 + Math.pow(rnd(), 0.9) * (H - 0.8);
    const t = (y - 0.8) / (H - 0.8);
    const R = Math.sin(Math.min(1, t * 1.15 + 0.05) * Math.PI) * 0.75 * (1 - t * 0.35) + 0.08;
    const a = rnd() * Math.PI * 2;
    const r = R * Math.sqrt(rnd()) * 0.9;
    cards(leaves, new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r), crown, 1, 0.75, 0.05, rnd);
  }
  return { wood: mergeGeometries(wood)!, leaves: mergeGeometries(leaves)! };
}

/** Date palm: a ringed, leaning trunk and a crown of long drooping fronds with hanging date clusters. */
function palm(seed: number): Built & { dates: THREE.BufferGeometry } {
  const rnd = seeded(seed);
  const lean = 0.6 + rnd() * 0.8;
  const H = 5 + rnd() * 1.6;
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(lean * 0.15, H * 0.35, 0), new THREE.Vector3(lean * 0.5, H * 0.7, 0), new THREE.Vector3(lean, H, 0)]);
  const trunk = new THREE.TubeGeometry(curve, 30, 0.19, 8, false);
  const pos = trunk.attributes.position as THREE.BufferAttribute;
  const uv = trunk.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const u = uv.getX(i);
    const c = curve.getPointAt(u);
    // Leaf-base rings: each segment swells at its top.
    const swell = 1 + 0.2 * Math.pow((u * 18) % 1, 2.5) - u * 0.2 + (u < 0.05 ? (0.05 - u) * 6 : 0);
    pos.setXYZ(i, c.x + (pos.getX(i) - c.x) * swell, c.y + (pos.getY(i) - c.y) * swell, c.z + (pos.getZ(i) - c.z) * swell);
    uv.setXY(i, uv.getY(i), u * 8);
  }
  trunk.computeVertexNormals();
  const top = curve.getPointAt(1);
  const fronds: THREE.BufferGeometry[] = [];
  const n = 14 + Math.floor(rnd() * 4);
  for (let k = 0; k < n; k++) {
    const len = 2.6 + rnd() * 0.8;
    const g = new THREE.PlaneGeometry(1.3, len, 1, 12);
    const p = g.attributes.position as THREE.BufferAttribute;
    const ring = k % 3;
    const lift = ring === 0 ? 0.9 : ring === 1 ? 0.45 : 0.05;
    for (let i = 0; i < p.count; i++) {
      const l = p.getY(i) + len / 2;
      const s = l / len;
      const th = lift - s * s * 1.9;
      const w = p.getX(i);
      // Leaflets fold up from the midrib in a shallow V.
      p.setXYZ(i, w * (1 - s * 0.5), Math.sin(th) * l * 0.9 + Math.abs(w) * 0.25, Math.cos(th) * l);
    }
    g.computeVertexNormals();
    g.rotateY((k / n) * Math.PI * 2 + rnd() * 0.4);
    g.translate(top.x, top.y, top.z);
    fronds.push(g.toNonIndexed());
  }
  const dates: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 3; k++) {
    const a = rnd() * Math.PI * 2;
    const g = new THREE.SphereGeometry(0.22, 7, 6).scale(0.8, 1.4, 0.8);
    g.translate(top.x + Math.cos(a) * 0.3, top.y - 0.45, top.z + Math.sin(a) * 0.3);
    dates.push(g.toNonIndexed());
  }
  return { wood: trunk.toNonIndexed(), leaves: mergeGeometries(fronds)!, dates: mergeGeometries(dates)! };
}

// ── Wind ────────────────────────────────────────────────────────────────────

/** Sway from the ground up (limbs), plus a quick flutter for leaves. Works on instanced meshes and their shadows. */
export function windy<M extends THREE.Material>(mat: M, o: { bend: number; flutter: number; time: { value: number }; key: string }) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev?.call(mat, sh, r);
    sh.uniforms.uTime = o.time;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;').replace(
      '#include <begin_vertex>',
      /* glsl */ `#include <begin_vertex>
      vec3 wo = vec3(0.);
      #ifdef USE_INSTANCING
        wo = (instanceMatrix * vec4(0., 0., 0., 1.)).xyz;
      #endif
      float hh = max(0., position.y);
      float ph = uTime * 1.15 + wo.x * 0.31 + wo.z * 0.23;
      float gust = 0.5 + 0.5 * sin(uTime * 0.3 + wo.x * 0.035 - wo.z * 0.02);
      gust *= gust;
      vec2 bend = vec2(sin(ph) + 0.4 * sin(ph * 2.3 + 1.1), cos(ph * 0.8) * 0.5) * (0.35 + gust) * hh * hh * ${o.bend.toFixed(5)};
      transformed.xz += bend;
      transformed.y -= dot(bend, bend) * 0.5 / max(hh, 0.1);
      float fl = ${o.flutter.toFixed(4)} * (0.4 + gust);
      transformed += vec3(sin(uTime * 7.3 + position.x * 9. + position.z * 5.), sin(uTime * 8.9 + position.y * 7.), cos(uTime * 6.1 + position.z * 9.)) * fl * min(hh, 1.);`,
    );
  };
  mat.customProgramCacheKey = () => `windy-${o.key}`;
  return mat;
}

// ── Kits used by the world ──────────────────────────────────────────────────

export type TreeKind = 'oak' | 'olive' | 'pine' | 'cypress' | 'palm';
export type TreeKit = { variants: { wood: THREE.BufferGeometry; leaves: THREE.BufferGeometry; dates?: THREE.BufferGeometry }[]; wood: THREE.Material; leaves: THREE.Material; depth: THREE.Material; dates?: THREE.Material };

export function treeKit(kind: TreeKind, time: { value: number }): TreeKit {
  const tex = kind === 'pine' ? leafCard('needle', 5) : kind === 'cypress' ? leafCard('scale', 6) : kind === 'olive' ? leafCard('olive', 7) : kind === 'palm' ? frondTexture() : leafCard('broad', 8);
  const bark = barkTexture(kind === 'olive' || kind === 'palm');
  bark.wrapS = bark.wrapT = THREE.RepeatWrapping;
  const variants = [0, 1, 2].map((v) => {
    const s = 100 + v * 31 + kind.length * 7;
    if (kind === 'oak') return broadleaf(s, { h: 2.4 + v * 0.3, r: 0.3, spread: 2.2, levels: 3, leaf: 1.25, cards: 7, gnarl: 0.35 });
    if (kind === 'olive') return broadleaf(s, { h: 1.3 + v * 0.2, r: 0.26, spread: 1.6, levels: 2, leaf: 1.05, cards: 9, gnarl: 0.6, twin: v !== 1 });
    if (kind === 'pine') return pine(s);
    if (kind === 'cypress') return cypress(s);
    return palm(s);
  });
  const leafColor = { oak: '#b9d0a8', olive: '#c9d4c0', pine: '#a9c4b4', cypress: '#9ab8a6', palm: '#c4d6a8' }[kind];
  const leaves = windy(
    new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.42, side: THREE.DoubleSide, color: leafColor, roughness: 0.82, emissive: '#0c1a10', emissiveIntensity: 0.5 }),
    { bend: kind === 'palm' ? 0.006 : kind === 'cypress' ? 0.0028 : 0.0035, flutter: kind === 'palm' ? 0.035 : 0.022, time, key: `leaves-${kind}` },
  );
  const depth = windy(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.42 }), { bend: kind === 'palm' ? 0.006 : 0.0035, flutter: 0, time, key: `depth-${kind}` });
  const wood = windy(new THREE.MeshStandardMaterial({ map: bark, bumpMap: bark, bumpScale: 1.5, roughness: 0.95, color: kind === 'palm' ? '#a68e78' : '#ffffff' }), { bend: kind === 'palm' ? 0.006 : 0.0035, flutter: 0, time, key: `wood-${kind}` });
  return { variants, wood, leaves, depth, dates: kind === 'palm' ? new THREE.MeshStandardMaterial({ color: '#b5651d', roughness: 0.6 }) : undefined };
}

/** A clump of curved grass blades, darker at the root, paler at the tip. */
export function grassClump(blades = 7, height = 0.5) {
  const rnd = seeded(blades * 13 + Math.round(height * 100));
  const parts: THREE.BufferGeometry[] = [];
  for (let b = 0; b < blades; b++) {
    const h = height * (0.6 + rnd() * 0.6);
    const w = 0.035 + rnd() * 0.02;
    const lean = (rnd() - 0.2) * 0.5;
    const a = rnd() * Math.PI * 2;
    const ox = (rnd() - 0.5) * 0.18;
    const oz = (rnd() - 0.5) * 0.18;
    const pos: number[] = [];
    const col: number[] = [];
    const seg = 3;
    for (let i = 0; i <= seg; i++) {
      const t = i / seg;
      const ww = w * (1 - t * 0.92);
      const bend = lean * t * t * h;
      for (const s of [-1, 1]) {
        pos.push(s * ww, t * h, bend);
        const c = 0.35 + t * 0.65;
        col.push(0.16 * c + 0.05, 0.3 * c + 0.06, 0.2 * c + 0.05);
      }
    }
    const idx: number[] = [];
    for (let i = 0; i < seg; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.rotateY(a);
    g.translate(ox, 0, oz);
    parts.push(g.toNonIndexed());
  }
  const m = mergeGeometries(parts)!;
  // Normals up-ish: grass lit by the sky, not flat-shaded edge-on.
  const n = new Float32Array(m.attributes.position!.count * 3);
  for (let i = 0; i < n.length; i += 3) n.set([0, 1, 0], i);
  m.setAttribute('normal', new THREE.BufferAttribute(n, 3));
  return m;
}

/** Reeds and bulrushes for the banks: tall thin blades and brown seed heads. */
export function reedClump() {
  const rnd = seeded(71);
  const blades: THREE.BufferGeometry[] = [];
  const heads: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 9; i++) {
    const h = 0.9 + rnd() * 0.7;
    const g = new THREE.CylinderGeometry(0.006, 0.02, h, 3, 2).translate(0, h / 2, 0);
    g.rotateZ((rnd() - 0.5) * 0.25);
    g.rotateY(rnd() * 6);
    const x = (rnd() - 0.5) * 0.4;
    const z = (rnd() - 0.5) * 0.4;
    g.translate(x, 0, z);
    blades.push(g.toNonIndexed());
    if (i % 3 === 0) heads.push(new THREE.CylinderGeometry(0.035, 0.035, 0.22, 6).translate(x, h * 0.9, z).toNonIndexed());
  }
  return { blades: mergeGeometries(blades)!, heads: mergeGeometries(heads)! };
}

/** A round shrub of leaf cards (optionally in bloom). */
export function shrub(seed: number, bloom: boolean) {
  const rnd = seeded(seed);
  const out: THREE.BufferGeometry[] = [];
  const crown = new THREE.Vector3(0, 0.45, 0);
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * 0.55;
    cards(out, new THREE.Vector3(Math.cos(a) * r, 0.25 + rnd() * 0.55, Math.sin(a) * r), crown, 1, 0.6, 0.05, rnd);
  }
  return { geo: mergeGeometries(out)!, tex: leafCard(bloom ? 'bloom' : 'shrub', seed) };
}

export const variantsOf = { broadleaf, pine, cypress, palm };
