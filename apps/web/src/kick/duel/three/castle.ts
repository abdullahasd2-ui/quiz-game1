// One castle, built from real geometry: a square curtain wall with battlements, four round corner towers with
// conical tiled roofs and banners, a tall keep, and a gatehouse with two hinged oak doors and an iron portcullis.
// Everything the game changes is exposed: the build stages, the gate, the windows, the torches and the roofs that fall.
import * as THREE from 'three';
import { planksTexture, roofTexture, stoneTextures, woodTexture } from './textures';

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
  /** Long team banners hanging down the front wall: they sway from the top. */
  drapes: THREE.Mesh[];
  /** The drawbridge (pivots on its inner edge) and its two chains, re-aimed every frame. */
  bridge: THREE.Object3D;
  chains: { mesh: THREE.Mesh; from: THREE.Vector3; tip: THREE.Vector3 }[];
  /** The winch wheels on the gatehouse: they turn while the bridge moves. */
  wheels: THREE.Object3D[];
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

const shared: { stone?: ReturnType<typeof stoneTextures>; wood?: THREE.Texture; planks?: THREE.Texture; chain?: THREE.Texture } = {};

/** The closed drawbridge leans back at this angle (radians from flat). */
export const BRIDGE_UP = 1.42;

function chainTexture() {
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.strokeStyle = '#9a9aa8';
  g.lineWidth = 3;
  for (let y = 0; y < 64; y += 16) {
    g.beginPath();
    g.ellipse(8, y + 8, 4, 7, 0, 0, Math.PI * 2);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Small copies of one geometry at many places (one draw call). */
function scatter(geo: THREE.BufferGeometry, mat: THREE.Material, mats: THREE.Matrix4[], cast = true) {
  const m = new THREE.InstancedMesh(geo, mat, mats.length);
  mats.forEach((x, i) => m.setMatrixAt(i, x));
  m.castShadow = cast;
  m.receiveShadow = true;
  return m;
}
const at = (x: number, y: number, z: number, ry = 0, s = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(s, s, s));

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
  shared.planks ??= planksTexture();
  shared.chain ??= chainTexture();
  const root = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ map: shared.stone.map, bumpMap: shared.stone.bump, bumpScale: 0.6, roughness: 0.92, metalness: 0.02, color: '#d8d6e8' });
  const stoneDark = stone.clone();
  stoneDark.color = new THREE.Color('#9a9ab0');
  const roof = new THREE.MeshStandardMaterial({ map: roofTexture(team.dark), roughness: 0.55, metalness: 0.15, color: team.light });
  const wood = new THREE.MeshStandardMaterial({ map: shared.wood, roughness: 0.8 });
  const iron = new THREE.MeshStandardMaterial({ color: '#4a4a55', metalness: 0.85, roughness: 0.35 });
  const windows = new THREE.MeshStandardMaterial({ color: '#1a1206', emissive: new THREE.Color(team.light).lerp(new THREE.Color('#ffcf7a'), 0.55), emissiveIntensity: 1.6 });
  const gold = new THREE.MeshStandardMaterial({ color: '#e8b64c', metalness: 0.9, roughness: 0.3, emissive: '#3a2200', emissiveIntensity: 0.4 });
  const slit = new THREE.MeshStandardMaterial({ color: '#07060c', roughness: 1 });
  const deck = new THREE.MeshStandardMaterial({ map: shared.planks, roughness: 0.85 });
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
  // A battered (sloping) stone base, like a real fortress foot, with a step of dressed stone on top.
  const plinth = shadow(new THREE.Mesh(new THREE.CylinderGeometry(((S + 1.6) / 2) * Math.SQRT2, ((S + 2.6) / 2) * Math.SQRT2, 0.9, 4, 1), stoneDark));
  plinth.rotation.y = Math.PI / 4;
  plinth.position.y = 0.05;
  root.add(plinth);
  const step = shadow(new THREE.Mesh(new THREE.BoxGeometry(S + 1.75, 0.12, S + 1.75), stone));
  step.position.y = 0.52;
  root.add(step);
  const walls = new THREE.Group();
  const side = (w: number, x: number, z: number, rot: number) => {
    const m = shadow(new THREE.Mesh(new THREE.BoxGeometry(w, H, T), stone));
    m.position.set(x, 0.5 + H / 2, z);
    m.rotation.y = rot;
    walls.add(m);
    walls.add(battlements(w, 0.5 + H + 0.19, 0, T * 0.9, stone, rot, 0).translateX(x).translateZ(z));
    // A projecting band under the parapet and a thin string course halfway up: the wall reads as built, not cast.
    for (const [y, hh, d] of [[0.5 + H - 0.12, 0.2, T + 0.16], [0.5 + H * 0.42, 0.08, T + 0.06]] as const) {
      const band = shadow(new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), stoneDark));
      band.position.set(x, y, z);
      band.rotation.y = rot;
      walls.add(band);
    }
    // Arrow slits on the outer face.
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rot, 0));
    const out = new THREE.Vector3(0, 0, T / 2 + 0.005).applyQuaternion(q);
    const sign = Math.sign(x * Math.sin(rot) + z * Math.cos(rot)) || 1;
    const mats: THREE.Matrix4[] = [];
    for (let i = 1; i < Math.floor(w / 1.1); i++) {
      const along = new THREE.Vector3(-w / 2 + i * 1.1, 0, 0).applyQuaternion(q);
      mats.push(new THREE.Matrix4().compose(new THREE.Vector3(x, 0.5 + H * 0.66, z).add(along).addScaledVector(out, sign), q, new THREE.Vector3(1, 1, 1)));
    }
    if (mats.length) walls.add(scatter(new THREE.BoxGeometry(0.07, 0.42, 0.02), slit, mats, false));
  };
  side(S, 0, -S / 2, 0);
  side(S, -S / 2, 0, Math.PI / 2);
  side(S, S / 2, 0, Math.PI / 2);
  const gap = 1.7;
  const fw = (S - gap) / 2;
  side(fw, -(gap / 2 + fw / 2), S / 2, 0);
  side(fw, gap / 2 + fw / 2, S / 2, 0);
  // Buttresses along the front wall: sloped stone piers.
  const pier = new THREE.CylinderGeometry(0.22 * Math.SQRT2, 0.34 * Math.SQRT2, H - 0.2, 4);
  pier.rotateY(Math.PI / 4);
  walls.add(scatter(pier, stoneDark, [-2.05, 2.05].map((x) => at(x, 0.5 + (H - 0.2) / 2, S / 2 + T / 2 + 0.18))));
  // Long team banners down the front wall, either side of the gate.
  const drapes: THREE.Mesh[] = [];
  for (const x of [-1.95, 1.95]) {
    const d = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 1.6, 4, 10), banner);
    d.geometry.translate(0, -0.8, 0);
    d.position.set(x, 0.5 + H - 0.2, S / 2 + T / 2 + 0.42);
    d.castShadow = true;
    walls.add(d);
    drapes.push(d);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.8, 6), gold);
    rod.rotation.z = Math.PI / 2;
    rod.position.set(x, 0.5 + H - 0.18, S / 2 + T / 2 + 0.42);
    walls.add(rod);
  }
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
  // Corner pilasters, a corbelled band at the top, arched window heads with sills, and the team crest.
  keep.add(scatter(new THREE.BoxGeometry(0.34, 5.2, 0.34), stoneDark, [-1, 1].flatMap((sx) => [-1, 1].map((sz) => at(sx * 1.42, 0.5 + 2.6, -0.9 + sz * 1.42)))));
  const kband = shadow(new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.22, 3.1), stoneDark));
  kband.position.set(0, 0.5 + 5.2 - 0.1, -0.9);
  keep.add(kband);
  const corb: THREE.Matrix4[] = [];
  for (let i = 0; i < 7; i++) for (const r of [0, 1, 2, 3]) {
    const a = (r * Math.PI) / 2;
    const u = -1.2 + i * 0.4;
    corb.push(at(Math.cos(a) * u + Math.sin(a) * 1.5, 0.5 + 5.2 - 0.32, -0.9 + -Math.sin(a) * u + Math.cos(a) * 1.5, a));
  }
  keep.add(scatter(new THREE.BoxGeometry(0.16, 0.22, 0.18), stoneDark, corb));
  for (const [x, y] of [[-0.6, 4.2], [0.6, 4.2], [0, 2.6]] as const) {
    const head = new THREE.Mesh(new THREE.CircleGeometry(0.17, 12, 0, Math.PI), windows);
    head.position.set(x, y + 0.3, -0.9 + 1.42);
    keep.add(head);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.07, 0.16), stoneDark);
    sill.position.set(x, y - 0.33, -0.9 + 1.46);
    keep.add(sill);
  }
  // The crest: a team shield with a gold rim and a gold star, under the keep's top band.
  const shieldShape = new THREE.Shape();
  shieldShape.moveTo(-0.42, 0.42);
  shieldShape.lineTo(0.42, 0.42);
  shieldShape.lineTo(0.42, 0);
  shieldShape.quadraticCurveTo(0.4, -0.38, 0, -0.56);
  shieldShape.quadraticCurveTo(-0.4, -0.38, -0.42, 0);
  shieldShape.closePath();
  const rim = new THREE.Mesh(new THREE.ExtrudeGeometry(shieldShape, { depth: 0.06, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.03, bevelSegments: 2 }), gold);
  rim.position.set(0, 0.5 + 3.5, -0.9 + 1.42);
  keep.add(rim);
  const field = new THREE.Mesh(new THREE.ShapeGeometry(shieldShape), new THREE.MeshStandardMaterial({ color: team.dark, emissive: team.light, emissiveIntensity: 0.35, roughness: 0.5 }));
  field.scale.setScalar(0.86);
  field.position.set(0, 0.5 + 3.5 + 0.02, -0.9 + 1.42 + 0.12);
  keep.add(field);
  const starShape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const rr = i % 2 ? 0.08 : 0.2;
    if (i) starShape.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else starShape.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  const star = new THREE.Mesh(new THREE.ShapeGeometry(starShape), gold);
  star.position.set(0, 0.5 + 3.52, -0.9 + 1.42 + 0.13);
  keep.add(star);
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
    const band = shadow(new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.05, 6, quality === 'high' ? 24 : 12), stoneDark));
    band.rotation.x = Math.PI / 2;
    band.position.set(x, 0.5 + H + 0.75, S / 2 + 0.15);
    gate.add(band);
    const sl = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.5, 0.04), slit);
    sl.position.set(x, 0.5 + H * 0.62, S / 2 + 0.15 + 0.68);
    gate.add(sl);
    const fin = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), gold);
    fin.position.set(x, 0.5 + H + 1.1 + 1.12, S / 2 + 0.15);
    gate.add(fin);
  }
  // Two winch wheels above the arch: they turn while the drawbridge moves.
  const wheels: THREE.Object3D[] = [];
  for (const x of [-0.55, 0.55]) {
    const w = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 6, 16), iron);
    w.add(tire);
    for (let k = 0; k < 3; k++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.03, 0.03), iron);
      spoke.rotation.z = (k * Math.PI) / 3;
      w.add(spoke);
    }
    w.position.set(x, 0.5 + H + 0.32, S / 2 + T / 2 + 0.09);
    gate.add(w);
    wheels.push(w);
  }
  // The drawbridge: an oak deck on a pivot at the foot of the gate, two chains to the winches.
  const bridge = new THREE.Group();
  bridge.position.set(0, 0.5, S / 2 + 0.8);
  const BL = 3.9;
  const deckMesh = shadow(new THREE.Mesh(new THREE.BoxGeometry(gap + 0.2, 0.14, BL), deck));
  deckMesh.position.set(0, 0.07, BL / 2);
  bridge.add(deckMesh);
  for (const x of [-(gap + 0.2) / 2, (gap + 0.2) / 2]) {
    const beam = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, BL), wood));
    beam.position.set(x, 0.1, BL / 2);
    bridge.add(beam);
  }
  bridge.rotation.x = -BRIDGE_UP;
  gate.add(bridge);
  const chainMat = new THREE.MeshStandardMaterial({ map: shared.chain, color: '#b8b8c8', metalness: 0.8, roughness: 0.4, transparent: true, alphaTest: 0.3 });
  const chains = [-1, 1].map((sg) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 5, 1, true), chainMat);
    mesh.geometry.translate(0, 0.5, 0);
    gate.add(mesh);
    return { mesh, from: new THREE.Vector3(sg * 0.55, 0.5 + H + 0.32, S / 2 + T / 2 + 0.12), tip: new THREE.Vector3(sg * ((gap + 0.2) / 2), 0.2, BL - 0.15) };
  });
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
    // Machicolation corbels under the top ring, a string course, and arrow slits round the drum.
    const cm: THREE.Matrix4[] = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      cm.push(at(x + Math.cos(a) * 1.02, 0.5 + th - 0.24, z + Math.sin(a) * 1.02, -a));
    }
    towers.add(scatter(new THREE.BoxGeometry(0.14, 0.26, 0.16), stoneDark, cm));
    const sc = shadow(new THREE.Mesh(new THREE.TorusGeometry(1.03, 0.045, 6, seg), stoneDark));
    sc.rotation.x = Math.PI / 2;
    sc.position.set(x, 0.5 + th * 0.3, z);
    towers.add(sc);
    const sm: THREE.Matrix4[] = [];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.6;
      sm.push(new THREE.Matrix4().compose(new THREE.Vector3(x + Math.cos(a) * 1.0, 0.5 + th * 0.55, z + Math.sin(a) * 1.0), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -a + Math.PI / 2, 0)), new THREE.Vector3(1, 1, 1)));
    }
    towers.add(scatter(new THREE.BoxGeometry(0.07, 0.4, 0.06), slit, sm, false));
    const r = shadow(new THREE.Mesh(new THREE.ConeGeometry(1.22, 2.3, seg), roof));
    r.position.set(x, 0.5 + th + 1.35, z);
    towers.add(r);
    roofs.push(r);
    roofTops.push(new THREE.Vector3(x, 0.5 + th + 0.5, z));
    for (const y of [th * 0.45, th * 0.75]) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.42, 0.05), windows);
      w.position.set(x, 0.5 + y, z + 1.04);
      towers.add(w);
      const head = new THREE.Mesh(new THREE.CircleGeometry(0.11, 10, 0, Math.PI), windows);
      head.position.set(x, 0.5 + y + 0.21, z + 1.065);
      towers.add(head);
    }
    // A gold ring at the eaves and a gold finial on the roof (they fall with it).
    const eave = new THREE.Mesh(new THREE.TorusGeometry(1.16, 0.05, 6, seg), gold);
    eave.rotation.x = Math.PI / 2;
    eave.position.y = -1.12;
    r.add(eave);
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
    drapes,
    bridge,
    chains,
    wheels,
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

/** Hanging banners sway from their top edge, more at the hem. */
export function waveDrapes(drapes: THREE.Mesh[], t: number, wind: number) {
  for (const [k, d] of drapes.entries()) {
    const pos = d.geometry.attributes.position as THREE.BufferAttribute;
    const orig = (d.userData.orig ??= Float32Array.from(pos.array as Float32Array)) as Float32Array;
    for (let i = 0; i < pos.count; i++) {
      const x = orig[i * 3]!;
      const y = orig[i * 3 + 1]!;
      const w = -y / 1.6;
      pos.setZ(i, (Math.sin(t * 1.6 * wind + k * 1.7 + y * 2) * 0.09 + Math.sin(t * 3.1 + x * 6) * 0.02) * w);
      pos.setX(i, x + Math.sin(t * 1.1 + k) * 0.04 * w);
    }
    pos.needsUpdate = true;
    d.geometry.computeVertexNormals();
  }
}

/** Points the drawbridge chains from their winch to the bridge tip. */
export function aimChains(c: CastleParts) {
  c.bridge.updateMatrix();
  for (const ch of c.chains) {
    const tip = ch.tip.clone().applyMatrix4(c.bridge.matrix);
    const dir = tip.clone().sub(ch.from);
    const len = dir.length();
    ch.mesh.position.copy(ch.from);
    ch.mesh.scale.set(1, len, 1);
    ch.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    (ch.mesh.material as THREE.MeshStandardMaterial).map!.repeat.set(1, len * 3);
  }
}
