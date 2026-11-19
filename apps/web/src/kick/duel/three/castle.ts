// One castle, built from real geometry: a square curtain wall with battlements, four round corner towers with
// conical tiled roofs and banners, a tall keep, and a gatehouse with two hinged oak doors and an iron portcullis.
// Everything the game changes is exposed: the build stages, the gate, the windows, the torches and the roofs that fall.
import * as THREE from 'three';
import { roofTexture, stoneTextures, woodTexture } from './textures';

export type CastleParts = {
  root: THREE.Group;
  /** The parts that rise in the lobby: 1 wall, 2 keep and gate, 3 towers, 4 banners. */
  stages: THREE.Object3D[][];
  doors: [THREE.Object3D, THREE.Object3D];
  portcullis: THREE.Object3D;
  /** Window glass: their emissive intensity flickers. */
  windows: THREE.MeshStandardMaterial;
  /** Roofs that fall with the damage, top of the keep last. */
  roofs: THREE.Mesh[];
  /** Where fire burns once a roof is gone. */
  roofTops: THREE.Vector3[];
  banners: THREE.Mesh[];
  /** Torch positions on the front wall (local). */
  torches: THREE.Vector3[];
  /** The courtyard light that spills out of the open gate. */
  inner: THREE.PointLight;
  /** The castle's own coloured light. */
  aura: THREE.PointLight;
  /** Where a fireball lands. */
  target: THREE.Vector3;
  /** Where a fireball leaves from. */
  muzzle: THREE.Vector3;
};

const shared: { stone?: ReturnType<typeof stoneTextures>; wood?: THREE.Texture } = {};

function battlements(width: number, y: number, z: number, depth: number, mat: THREE.Material, rot = 0, x0 = 0) {
  const n = Math.floor(width / 0.55);
  const geo = new THREE.BoxGeometry(0.32, 0.38, depth);
  const mesh = new THREE.InstancedMesh(geo, mat, Math.ceil(n / 2) + 1);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rot, 0));
  let k = 0;
  for (let i = 0; i <= n; i += 2) {
    const along = -width / 2 + (i / n) * width;
    const p = new THREE.Vector3(along, y, 0).applyQuaternion(q).add(new THREE.Vector3(x0, 0, z));
    m.compose(p, q, new THREE.Vector3(1, 1, 1));
    mesh.setMatrixAt(k++, m);
  }
  mesh.count = k;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function buildCastle(team: { light: string; dark: string }, quality: 'high' | 'low'): CastleParts {
  shared.stone ??= stoneTextures();
  shared.wood ??= woodTexture();
  const root = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ map: shared.stone.map, bumpMap: shared.stone.bump, bumpScale: 0.6, roughness: 0.92, metalness: 0.02, color: '#d8d6e8' });
  const stoneDark = stone.clone();
  stoneDark.color = new THREE.Color('#9a9ab0');
  const roof = new THREE.MeshStandardMaterial({ map: roofTexture(team.dark), roughness: 0.55, metalness: 0.15, color: team.light });
  const wood = new THREE.MeshStandardMaterial({ map: shared.wood, roughness: 0.8 });
  const iron = new THREE.MeshStandardMaterial({ color: '#4a4a55', metalness: 0.85, roughness: 0.35 });
  const windows = new THREE.MeshStandardMaterial({ color: '#1a1206', emissive: new THREE.Color(team.light).lerp(new THREE.Color('#ffcf7a'), 0.55), emissiveIntensity: 1.6 });
  const banner = new THREE.MeshStandardMaterial({ color: team.light, side: THREE.DoubleSide, roughness: 0.7, emissive: team.dark, emissiveIntensity: 0.25 });
  const shadow = <T extends THREE.Object3D>(o: T) => {
    o.traverse((c) => {
      if ((c as THREE.Mesh).isMesh) {
        c.castShadow = true;
        c.receiveShadow = true;
      }
    });
    return o;
  };
  const S = 6.4; // courtyard size
  const H = 2.6; // wall height
  const T = 0.7; // wall thickness
  const stages: THREE.Object3D[][] = [[], [], [], [], []];

  // ── Stage 1: plinth and curtain walls (the front one split around the gate) ──
  const plinth = shadow(new THREE.Mesh(new THREE.BoxGeometry(S + 1.6, 0.5, S + 1.6), stoneDark));
  plinth.position.y = 0.25;
  root.add(plinth);
  const walls = new THREE.Group();
  const side = (w: number, x: number, z: number, rot: number) => {
    const m = shadow(new THREE.Mesh(new THREE.BoxGeometry(w, H, T), stone));
    m.position.set(x, 0.5 + H / 2, z);
    m.rotation.y = rot;
    walls.add(m);
    walls.add(battlements(w, 0.5 + H + 0.19, 0, T * 0.9, stone, rot, 0).translateX(x).translateZ(z));
  };
  side(S, 0, -S / 2, 0);
  side(S, -S / 2, 0, Math.PI / 2);
  side(S, S / 2, 0, Math.PI / 2);
  const gap = 1.7;
  const fw = (S - gap) / 2;
  side(fw, -(gap / 2 + fw / 2), S / 2, 0);
  side(fw, gap / 2 + fw / 2, S / 2, 0);
  root.add(walls);
  stages[1]!.push(walls);

  // ── Stage 2: the keep and the gatehouse ──
  const keep = new THREE.Group();
  const kb = shadow(new THREE.Mesh(new THREE.BoxGeometry(2.8, 5.2, 2.8), stone));
  kb.position.set(0, 0.5 + 2.6, -0.9);
  keep.add(kb);
  keep.add(battlements(2.8, 0.5 + 5.2 + 0.19, 0, 0.3, stone, 0, 0).translateZ(-0.9 + 1.25));
  keep.add(battlements(2.8, 0.5 + 5.2 + 0.19, 0, 0.3, stone, 0, 0).translateZ(-0.9 - 1.25));
  keep.add(battlements(2.8, 0.5 + 5.2 + 0.19, 0, 0.3, stone, Math.PI / 2, 0).translateZ(-0.9).translateX(1.25));
  keep.add(battlements(2.8, 0.5 + 5.2 + 0.19, 0, 0.3, stone, Math.PI / 2, 0).translateZ(-0.9).translateX(-1.25));
  const keepRoof = shadow(new THREE.Mesh(new THREE.ConeGeometry(2.05, 2.6, 4, 1), roof));
  keepRoof.rotation.y = Math.PI / 4;
  keepRoof.position.set(0, 0.5 + 5.2 + 1.3, -0.9);
  keep.add(keepRoof);
  for (const [x, y] of [
    [-0.6, 4.2],
    [0.6, 4.2],
    [0, 2.6],
  ] as const) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.6, 0.06), windows);
    w.position.set(x, y, -0.9 + 1.42);
    keep.add(w);
  }
  root.add(keep);

  // Gatehouse: two small towers either side of the gate, a lintel, the doors and the portcullis.
  const gate = new THREE.Group();
  for (const x of [-1.25, 1.25]) {
    const t = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.7, H + 1.1, quality === 'high' ? 20 : 12), stone));
    t.position.set(x, 0.5 + (H + 1.1) / 2, S / 2 + 0.15);
    gate.add(t);
    const cap = shadow(new THREE.Mesh(new THREE.ConeGeometry(0.78, 1.1, quality === 'high' ? 20 : 12), roof));
    cap.position.set(x, 0.5 + H + 1.1 + 0.55, S / 2 + 0.15);
    gate.add(cap);
  }
  const lintel = shadow(new THREE.Mesh(new THREE.BoxGeometry(gap + 0.4, 0.7, T + 0.1), stone));
  lintel.position.set(0, 0.5 + H - 0.35 + 0.4, S / 2);
  gate.add(lintel);
  const arch = shadow(new THREE.Mesh(new THREE.TorusGeometry(gap / 2, 0.14, 8, 24, Math.PI), stoneDark));
  arch.position.set(0, 0.5 + 1.75, S / 2 + T / 2 + 0.02);
  gate.add(arch);
  // Hinged doors: each pivots on its outer edge.
  const doorGeo = new THREE.BoxGeometry(gap / 2, 1.95, 0.14);
  const doors = [-1, 1].map((sgn) => {
    const pivot = new THREE.Group();
    pivot.position.set((sgn * gap) / 2, 0.5, S / 2 + 0.05);
    const d = shadow(new THREE.Mesh(doorGeo, wood));
    d.position.set((-sgn * gap) / 4, 0.975, 0);
    pivot.add(d);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.02, 6, 12), iron);
    ring.position.set(-sgn * (gap / 2 - 0.15), 1.0, 0.09);
    pivot.add(ring);
    gate.add(pivot);
    return pivot;
  }) as unknown as [THREE.Object3D, THREE.Object3D];
  const portcullis = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.0, 0.05), iron);
    bar.position.set(-gap / 2 + 0.12 + (i * (gap - 0.24)) / 6, 1.0, 0);
    bar.castShadow = true;
    portcullis.add(bar);
  }
  for (let j = 0; j < 4; j++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(gap - 0.1, 0.05, 0.05), iron);
    bar.position.set(0, 0.3 + j * 0.5, 0);
    portcullis.add(bar);
  }
  portcullis.position.set(0, 0.5, S / 2 + T / 2 - 0.05);
  gate.add(portcullis);
  root.add(gate);
  stages[2]!.push(keep, gate);

  // ── Stage 3: four corner towers ──
  const towers = new THREE.Group();
  const roofs: THREE.Mesh[] = [];
  const roofTops: THREE.Vector3[] = [];
  const banners: THREE.Mesh[] = [];
  const masts: THREE.Object3D[] = [];
  const seg = quality === 'high' ? 24 : 14;
  for (const [x, z] of [
    [-S / 2, -S / 2],
    [S / 2, -S / 2],
    [-S / 2, S / 2],
    [S / 2, S / 2],
  ] as const) {
    const th = H + 2.2 + (z < 0 ? 0.6 : 0);
    const t = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.08, th, seg), stone));
    t.position.set(x, 0.5 + th / 2, z);
    towers.add(t);
    // A corbelled ring and crenels at the top.
    const ring = shadow(new THREE.Mesh(new THREE.CylinderGeometry(1.15, 0.98, 0.35, seg), stoneDark));
    ring.position.set(x, 0.5 + th + 0.05, z);
    towers.add(ring);
    const crenels = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 0.36, 0.3), stone, 8);
    const m = new THREE.Matrix4();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      m.makeTranslation(x + Math.cos(a) * 1.0, 0.5 + th + 0.4, z + Math.sin(a) * 1.0);
      crenels.setMatrixAt(i, m);
    }
    crenels.castShadow = true;
    towers.add(crenels);
    const r = shadow(new THREE.Mesh(new THREE.ConeGeometry(1.22, 2.3, seg), roof));
    r.position.set(x, 0.5 + th + 1.35, z);
    towers.add(r);
    roofs.push(r);
    roofTops.push(new THREE.Vector3(x, 0.5 + th + 0.5, z));
    for (const y of [th * 0.45, th * 0.75]) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.42, 0.05), windows);
      w.position.set(x, 0.5 + y, z + 1.04);
      towers.add(w);
    }
    // Banner on a pole at the tip of the roof (a child of the roof, so it falls with it).
    const mast = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.1, 6), iron);
    pole.position.y = 1.15 + 0.45;
    mast.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5, 12, 4), banner);
    flag.geometry.translate(0.45, 0, 0);
    flag.position.set(0.04, 1.15 + 0.82, 0);
    flag.castShadow = true;
    mast.add(flag);
    r.add(mast);
    masts.push(mast);
    banners.push(flag);
  }
  roofs.push(keepRoof);
  roofTops.push(new THREE.Vector3(0, 0.5 + 5.2 + 0.3, -0.9));
  root.add(towers);
  stages[3]!.push(towers);
  // Keep banner
  const kmast = new THREE.Group();
  const kpole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 6), iron);
  kpole.position.y = 1.3 + 0.65;
  kmast.add(kpole);
  const kflag = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.7, 14, 4), banner);
  kflag.geometry.translate(0.65, 0, 0);
  kflag.position.set(0.05, 1.3 + 1.1, 0);
  kmast.add(kflag);
  keepRoof.add(kmast);
  masts.push(kmast);
  banners.push(kflag);
  // Each mast stays on its roof; the stage only shows or hides them.
  stages[4]!.push(...masts);

  const inner = new THREE.PointLight(new THREE.Color(team.light).lerp(new THREE.Color('#ffd08a'), 0.6), 0, 9, 2);
  inner.position.set(0, 1.4, S / 2 - 1.2);
  root.add(inner);
  const aura = new THREE.PointLight(team.light, 6, 14, 2);
  aura.position.set(0, 4, S / 2 + 2.5);
  root.add(aura);

  return {
    root,
    stages,
    doors,
    portcullis,
    windows,
    roofs,
    roofTops,
    banners,
    torches: [-2.4, -1.4, 1.4, 2.4, 0].map((x, i) => new THREE.Vector3(x, i === 4 ? 0.5 + 5.2 + 0.1 : 0.5 + H + 0.25, i === 4 ? -0.9 + 1.5 : S / 2 + 0.45)),
    inner,
    aura,
    target: new THREE.Vector3(0, 3.6, 1.6),
    muzzle: new THREE.Vector3(0, 6.6, -0.9),
  };
}

/** Banners wave: their vertices follow a travelling sine, stronger toward the free edge. */
export function waveBanners(banners: THREE.Mesh[], t: number, wind: number) {
  for (const [k, b] of banners.entries()) {
    const pos = b.geometry.attributes.position as THREE.BufferAttribute;
    const orig = (b.userData.orig ??= Float32Array.from(pos.array as Float32Array)) as Float32Array;
    for (let i = 0; i < pos.count; i++) {
      const x = orig[i * 3]!;
      const y = orig[i * 3 + 1]!;
      const w = x / 1.3;
      pos.setZ(i, Math.sin(x * 4 - t * 5 * wind + k) * 0.16 * w + Math.sin(y * 3 + t * 3) * 0.04 * w);
    }
    pos.needsUpdate = true;
    b.geometry.computeVertexNormals();
  }
}
