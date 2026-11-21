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
  /** Where the doors scrape the ground and where the bridge's tip lands (local), for dust. */
  doorFoot: THREE.Vector3;
  bridgeTip: THREE.Vector3;
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

/** A pointed (two-centred) arch outline, from the springing line up; w = span, rise = height of the point above it. */
function pointedArch(path: THREE.Path | THREE.Shape, cx: number, y0: number, w: number, springH: number, rise: number, reverse = false) {
  const pts: THREE.Vector2[] = [new THREE.Vector2(cx - w / 2, y0), new THREE.Vector2(cx - w / 2, y0 + springH)];
  // Each half is an arc whose centre sits on the springing line, offset toward the far side.
  const r = (w * w) / 4 / (w / 2) / 2 + (rise * rise) / w;
  const off = r - w / 2;
  const top = y0 + springH;
  const n = 14;
  const a0 = Math.PI;
  const aTop = Math.PI - Math.acos(Math.min(1, (r - w / 2 + w / 2 - off) / r));
  for (let i = 1; i <= n; i++) {
    const a = a0 + ((Math.atan2(rise, -off) - a0) * i) / n;
    pts.push(new THREE.Vector2(cx + off + Math.cos(a) * r, top + Math.sin(a) * r * (a > Math.PI ? -1 : 1)));
  }
  void aTop;
  const left = pts.slice();
  const right = left.map((p) => new THREE.Vector2(2 * cx - p.x, p.y)).reverse();
  const all = [...left, ...right.slice(1)];
  const seq = reverse ? all.reverse() : all;
  path.moveTo(seq[0]!.x, seq[0]!.y);
  for (const p of seq.slice(1)) path.lineTo(p.x, p.y);
  return seq;
}

/** A simple semicircular-headed opening outline (for windows). */
function roundArch(path: THREE.Path | THREE.Shape, w: number, h: number, reverse = false) {
  const pts: THREE.Vector2[] = [new THREE.Vector2(-w / 2, -h / 2), new THREE.Vector2(-w / 2, h / 2 - w / 2)];
  for (let i = 1; i < 12; i++) {
    const a = Math.PI - (i / 12) * Math.PI;
    pts.push(new THREE.Vector2(Math.cos(a) * (w / 2), h / 2 - w / 2 + Math.sin(a) * (w / 2)));
  }
  pts.push(new THREE.Vector2(w / 2, h / 2 - w / 2), new THREE.Vector2(w / 2, -h / 2));
  const seq = reverse ? pts.reverse() : pts;
  path.moveTo(seq[0]!.x, seq[0]!.y);
  for (const p of seq.slice(1)) path.lineTo(p.x, p.y);
}

/** Damp and moss creep up the stone from the ground, and dry toward the top: walls look weathered, not new. */
function weathered(mat: THREE.MeshStandardMaterial, key: string) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;').replace(
      '#include <map_fragment>',
      `#include <map_fragment>
      float ny = sin(vWp.x * 3.1 + sin(vWp.z * 2.3)) * 0.5 + sin(vWp.z * 4.7 + vWp.x * 1.3) * 0.5;
      float damp = 1. - smoothstep(0.35, 1.7 + ny * 0.4, vWp.y);
      diffuseColor.rgb *= 1. - damp * 0.38;
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.72, 0.95, 0.62), damp * smoothstep(-0.2, 0.6, ny) * 0.6);
      // Sun-bleached upper courses.
      diffuseColor.rgb *= 1. + smoothstep(3.5, 7., vWp.y) * 0.08;`,
    );
  };
  mat.customProgramCacheKey = () => `weathered-${key}`;
  return mat;
}

export function buildCastle(team: { light: string; dark: string }, quality: 'high' | 'low'): CastleParts {
  shared.stone ??= stoneTextures();
  shared.wood ??= woodTexture();
  shared.planks ??= planksTexture();
  shared.chain ??= chainTexture();
  const root = new THREE.Group();
  const stone = weathered(new THREE.MeshStandardMaterial({ map: shared.stone.map, normalMap: shared.stone.normal, normalScale: new THREE.Vector2(1.1, 1.1), roughnessMap: shared.stone.rough, roughness: 1, metalness: 0.02, color: '#dcd8ea' }), 'stone');
  const stoneDark = weathered(stone.clone(), 'stoneDark');
  stoneDark.color = new THREE.Color('#a19eb6');
  // Dressed stone for the gate: larger blocks (the texture at a coarser scale), a little paler.
  const ashlarMap = shared.stone.map.clone();
  ashlarMap.repeat.set(0.42, 0.42);
  ashlarMap.needsUpdate = true;
  const ashlarN = shared.stone.normal.clone();
  ashlarN.repeat.set(0.42, 0.42);
  ashlarN.needsUpdate = true;
  const ashlar = weathered(new THREE.MeshStandardMaterial({ map: ashlarMap, normalMap: ashlarN, normalScale: new THREE.Vector2(1.3, 1.3), roughness: 0.9, color: '#e9e2ef' }), 'ashlar');
  const carved = new THREE.MeshStandardMaterial({ color: '#d9cfc0', roughness: 0.75 });
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
  /** A deep-set window: a stone surround with a real opening, the lit glass set back, iron glazing bars, a sill,
   *  and sometimes a pair of open wooden shutters. */
  const frameGeos = new Map<string, THREE.BufferGeometry>();
  const windowAt = (parent: THREE.Object3D, x: number, y: number, z: number, rotY: number, w: number, h: number, shutters: boolean) => {
    const key = `${w}x${h}`;
    let fg = frameGeos.get(key);
    if (!fg) {
      const outer = new THREE.Shape();
      roundArch(outer, w + 0.2, h + 0.16);
      const hole = new THREE.Path();
      roundArch(hole, w, h, true);
      outer.holes.push(hole);
      fg = new THREE.ExtrudeGeometry(outer, { depth: 0.16, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 1, curveSegments: 8 });
      frameGeos.set(key, fg);
    }
    const g = new THREE.Group();
    const frame = new THREE.Mesh(fg, stoneDark);
    frame.castShadow = true;
    g.add(frame);
    const glassShape = new THREE.Shape();
    roundArch(glassShape, w, h);
    const glass = new THREE.Mesh(new THREE.ShapeGeometry(glassShape, 8), windows);
    glass.position.z = 0.02;
    g.add(glass);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.025, h * 0.95, 0.025), iron);
    bar.position.z = 0.06;
    g.add(bar);
    const cross = new THREE.Mesh(new THREE.BoxGeometry(w * 0.95, 0.025, 0.025), iron);
    cross.position.set(0, -h * 0.08, 0.06);
    g.add(cross);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.07, 0.24), stoneDark);
    sill.position.set(0, -h / 2 - 0.09, 0.1);
    sill.castShadow = true;
    g.add(sill);
    if (shutters)
      for (const sg of [-1, 1]) {
        const sh = new THREE.Mesh(new THREE.BoxGeometry(w / 2, h * 0.82, 0.03), wood);
        sh.geometry.translate((sg * w) / 4, 0, 0);
        sh.position.set((sg * (w + 0.2)) / 2, -h * 0.06, 0.18);
        sh.rotation.y = sg * -2.2;
        sh.castShadow = true;
        g.add(sh);
      }
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    parent.add(g);
  };
  windowAt(keep, -0.6, 4.2, -0.9 + 1.33, 0, 0.34, 0.66, false);
  windowAt(keep, 0.6, 4.2, -0.9 + 1.33, 0, 0.34, 0.66, false);
  windowAt(keep, 0, 2.5, -0.9 + 1.33, 0, 0.4, 0.75, true);
  // Side faces of the keep get windows too, and a round rose window high on the back.
  for (const sx of [-1, 1]) windowAt(keep, sx * 1.33, 3.6, -0.9, (sx * Math.PI) / 2, 0.32, 0.6, sx > 0);
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

  // ── The great gate ──
  // A projecting gatehouse of large dressed blocks with a real pointed arch cut through it, two orders of recessed
  // archivolts, engaged columns with capitals, a carved band with eight-pointed stars, machicolations and a crenellated
  // parapet on top; flanking towers rise above it. Behind the arch: an arched tympanum, the two doors and the portcullis.
  const gate = new THREE.Group();
  const GW = 3.5; // gatehouse width
  const GH = H + 1.7; // gatehouse height
  const GD = T + 0.75; // depth
  const front = S / 2 + T / 2 + 0.38; // the front face
  const spring = 1.42; // springing height of the arch above the threshold
  const rise = 0.95;
  const y0 = 0.5;
  // One outline running round the wall and in through the arch, so the opening is cut clean to the ground.
  const archIn = pointedArch(new THREE.Path(), 0, 0, gap, spring, rise);
  const frontShape = new THREE.Shape([new THREE.Vector2(-GW / 2, 0), ...archIn, new THREE.Vector2(GW / 2, 0), new THREE.Vector2(GW / 2, GH), new THREE.Vector2(-GW / 2, GH)]);
  const house = shadow(new THREE.Mesh(new THREE.ExtrudeGeometry(frontShape, { depth: GD, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 1, curveSegments: 10 }), ashlar));
  house.position.set(0, y0, front - GD);
  gate.add(house);
  // Two recessed archivolt orders, stepping in toward the doors.
  for (const [k, inset] of [0.22, 0.42].entries()) {
    const outerA = pointedArch(new THREE.Path(), 0, 0, gap + 0.5 - inset, spring + 0.25 - inset * 0.3, rise + 0.25 - inset * 0.3);
    const innerA = pointedArch(new THREE.Path(), 0, 0, gap - inset * 0.25, spring - inset * 0.15, rise - inset * 0.2, true);
    const o = new THREE.Shape([...outerA, ...innerA]);
    const ring = shadow(new THREE.Mesh(new THREE.ExtrudeGeometry(o, { depth: 0.14, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1, curveSegments: 10 }), k ? carved : stoneDark));
    ring.position.set(0, y0, front - k * 0.12);
    ring.scale.setScalar(1);
    gate.add(ring);
  }
  // Voussoirs proud of the face round the arch, a bigger keystone at the top.
  const vPts: THREE.Vector2[] = [];
  pointedArch(new THREE.Path(), 0, 0, gap + 0.62, spring + 0.08, rise + 0.32).forEach((p) => vPts.push(p));
  const vm: THREE.Matrix4[] = [];
  for (let i = 2; i < vPts.length - 2; i += 2) {
    const p = vPts[i]!;
    const q = vPts[i + 1] ?? p;
    const a = Math.atan2(q.y - p.y, q.x - p.x);
    const key = Math.abs(p.x) < 0.12 ? 1.45 : 1;
    vm.push(new THREE.Matrix4().compose(new THREE.Vector3(p.x, y0 + p.y, front + 0.2), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, a + Math.PI / 2)), new THREE.Vector3(key, key, 1)));
  }
  gate.add(scatter(new THREE.BoxGeometry(0.34, 0.2, 0.12), carved, vm));
  // Engaged columns with bases and carved capitals, either side of the arch.
  for (const sx of [-1, 1]) {
    const col = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, spring - 0.1, 16), carved));
    col.position.set(sx * (gap / 2 + 0.36), y0 + 0.1 + (spring - 0.1) / 2, front + 0.08);
    gate.add(col);
    const base = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.3), carved));
    base.position.set(sx * (gap / 2 + 0.36), y0 + 0.08, front + 0.08);
    gate.add(base);
    const cap = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.12, 0.22, 4).rotateY(Math.PI / 4), carved));
    cap.position.set(sx * (gap / 2 + 0.36), y0 + spring + 0.06, front + 0.08);
    gate.add(cap);
    const abacus = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.06, 0.34), carved);
    abacus.position.set(sx * (gap / 2 + 0.36), y0 + spring + 0.2, front + 0.08);
    gate.add(abacus);
  }
  // Rusticated quoins on the gatehouse corners.
  const qm: THREE.Matrix4[] = [];
  for (let i = 0; i < 8; i++) for (const sx of [-1, 1]) qm.push(at(sx * (GW / 2 - (i % 2 ? 0.2 : 0.26)), y0 + 0.22 + i * (GH / 8), front + 0.03));
  gate.add(scatter(new THREE.BoxGeometry(0.5, GH / 8 - 0.05, 0.1), stoneDark, qm));
  // The carved band above the arch: a frieze of eight-pointed stars between two mouldings.
  const bandY = y0 + spring + rise + 0.55;
  for (const dy of [-0.2, 0.2]) {
    const mould = shadow(new THREE.Mesh(new THREE.BoxGeometry(GW + 0.1, 0.08, 0.16), carved));
    mould.position.set(0, bandY + dy, front + 0.06);
    gate.add(mould);
  }
  const starG = new THREE.Shape();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const r = i % 2 ? 0.07 : 0.13;
    if (i) starG.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    else starG.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const starGeo = new THREE.ExtrudeGeometry(starG, { depth: 0.04, bevelEnabled: false });
  const sm2: THREE.Matrix4[] = [];
  for (let i = -3; i <= 3; i++) sm2.push(at(i * 0.46, bandY, front + 0.03));
  gate.add(scatter(starGeo, gold, sm2, false));
  // Machicolations: a gallery of corbels carrying a crenellated parapet that overhangs the gate.
  const mc: THREE.Matrix4[] = [];
  for (let i = 0; i < 9; i++) mc.push(at(-GW / 2 + 0.2 + (i * (GW - 0.4)) / 8, y0 + GH - 0.3, front + 0.12));
  gate.add(scatter(new THREE.BoxGeometry(0.16, 0.36, 0.3), stoneDark, mc));
  const para = shadow(new THREE.Mesh(new THREE.BoxGeometry(GW + 0.3, 0.42, 0.34), ashlar));
  para.position.set(0, y0 + GH + 0.08, front + 0.1);
  gate.add(para);
  gate.add(battlements(GW + 0.2, y0 + GH + 0.48, front + 0.1, 0.3, ashlar, 0, 0));
  // Chain holes and the winch wheels on the face, between the band and the gallery.
  const wheels: THREE.Object3D[] = [];
  const winchY = y0 + GH - 0.85;
  for (const x of [-0.62, 0.62]) {
    const holeM = new THREE.Mesh(new THREE.CircleGeometry(0.09, 12), slit);
    holeM.position.set(x, winchY - 0.3, front + 0.01);
    gate.add(holeM);
    const w = new THREE.Group();
    w.add(new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 6, 18), iron));
    for (let k = 0; k < 3; k++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.03, 0.03), iron);
      spoke.rotation.z = (k * Math.PI) / 3;
      w.add(spoke);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 8).rotateX(Math.PI / 2), iron);
    w.add(hub);
    w.position.set(x * 1.45, winchY, front + 0.12);
    gate.add(w);
    wheels.push(w);
  }
  // Flanking towers: taller, with string courses, slits, and conical roofs.
  for (const x of [-GW / 2 - 0.35, GW / 2 + 0.35]) {
    const th = GH + 1.1;
    const t = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.76, th, quality === 'high' ? 24 : 12), stone));
    t.position.set(x, y0 + th / 2, front - 0.55);
    gate.add(t);
    const batter = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.95, 0.7, quality === 'high' ? 24 : 12), stoneDark));
    batter.position.set(x, y0 + 0.35, front - 0.55);
    gate.add(batter);
    for (const yy of [0.34, 0.72]) {
      const band = shadow(new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.05, 6, quality === 'high' ? 24 : 12), stoneDark));
      band.rotation.x = Math.PI / 2;
      band.position.set(x, y0 + th * yy, front - 0.55);
      gate.add(band);
    }
    const ring = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.86, 0.68, 0.3, quality === 'high' ? 24 : 12), stoneDark));
    ring.position.set(x, y0 + th, front - 0.55);
    gate.add(ring);
    const cap = shadow(new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.3, quality === 'high' ? 24 : 12), roof));
    cap.position.set(x, y0 + th + 0.8, front - 0.55);
    gate.add(cap);
    const sl = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.5, 0.04), slit);
    sl.position.set(x, y0 + th * 0.55, front - 0.55 + 0.74);
    gate.add(sl);
    const fin = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), gold);
    fin.position.set(x, y0 + th + 1.48, front - 0.55);
    gate.add(fin);
    windowAt(gate, x, y0 + th * 0.86, front - 0.55 + 0.72, 0, 0.18, 0.34, false);
  }
  // Behind the arch: an arched tympanum of planks above the doors, then the doors themselves.
  const tym = new THREE.Shape();
  pointedArch(tym, 0, 0, gap, spring, rise);
  tym.closePath();
  const tymM = new THREE.Mesh(new THREE.ShapeGeometry(tym, 10), wood);
  tymM.position.set(0, y0, S / 2 - 0.2);
  gate.add(tymM);
  // The drawbridge: an oak deck on a pivot at the foot of the gate, two chains up to the winches.
  const bridge = new THREE.Group();
  bridge.position.set(0, 0.5, front + 0.08);
  const BL = 4.3;
  const deckMesh = shadow(new THREE.Mesh(new THREE.BoxGeometry(gap + 0.3, 0.16, BL), deck));
  deckMesh.position.set(0, 0.08, BL / 2);
  bridge.add(deckMesh);
  for (const x of [-(gap + 0.3) / 2, (gap + 0.3) / 2]) {
    const beam = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.26, BL), wood));
    beam.position.set(x, 0.12, BL / 2);
    bridge.add(beam);
  }
  // Iron straps across the deck.
  for (let i = 0; i < 4; i++) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(gap + 0.34, 0.03, 0.08), iron);
    strap.position.set(0, 0.17, 0.4 + i * ((BL - 0.8) / 3));
    bridge.add(strap);
  }
  bridge.rotation.x = -BRIDGE_UP;
  gate.add(bridge);
  const chainMat = new THREE.MeshStandardMaterial({ map: shared.chain, color: '#b8b8c8', metalness: 0.8, roughness: 0.4, transparent: true, alphaTest: 0.3 });
  const chains = [-1, 1].map((sg) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 5, 1, true), chainMat);
    mesh.geometry.translate(0, 0.5, 0);
    gate.add(mesh);
    return { mesh, from: new THREE.Vector3(sg * 0.62, winchY - 0.3, front + 0.04), tip: new THREE.Vector3(sg * ((gap + 0.3) / 2), 0.2, BL - 0.15) };
  });
  // Hinged doors of studded oak with long iron strap hinges and ring pulls; each pivots on its outer edge.
  const doorH = spring + rise * 0.55;
  const doorGeo = new THREE.BoxGeometry(gap / 2, doorH, 0.16);
  const studGeo = new THREE.SphereGeometry(0.022, 6, 4);
  const doors = [-1, 1].map((sgn) => {
    const pivot = new THREE.Group();
    pivot.position.set((sgn * gap) / 2, 0.5, S / 2 + 0.05);
    const d = shadow(new THREE.Mesh(doorGeo, wood));
    d.position.set((-sgn * gap) / 4, doorH / 2, 0);
    pivot.add(d);
    for (const y of [0.32, doorH * 0.5, doorH - 0.32]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(gap / 2 - 0.08, 0.07, 0.03), iron);
      strap.position.set((-sgn * gap) / 4 + sgn * 0.02, y, 0.095);
      pivot.add(strap);
      const knuckle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.14, 8), iron);
      knuckle.position.set(sgn * -0.02, y, 0.06);
      pivot.add(knuckle);
    }
    const studs: THREE.Matrix4[] = [];
    for (let iy = 0; iy < 7; iy++) for (let ix = 0; ix < 3; ix++) studs.push(new THREE.Matrix4().makeTranslation(-sgn * (0.16 + ix * 0.24), 0.18 + iy * ((doorH - 0.36) / 6), 0.09));
    pivot.add(scatter(studGeo, iron, studs, false));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.018, 6, 14), iron);
    ring.position.set(-sgn * (gap / 2 - 0.16), doorH * 0.45, 0.11);
    pivot.add(ring);
    gate.add(pivot);
    return pivot;
  }) as unknown as [THREE.Object3D, THREE.Object3D];
  const portcullis = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.2, 0.05), iron);
    bar.position.set(-gap / 2 + 0.12 + (i * (gap - 0.24)) / 6, 1.1, 0);
    bar.castShadow = true;
    portcullis.add(bar);
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 4).rotateX(Math.PI), iron);
    spike.position.set(bar.position.x, -0.04, 0);
    portcullis.add(spike);
  }
  for (let j = 0; j < 5; j++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(gap - 0.1, 0.05, 0.05), iron);
    bar.position.set(0, 0.25 + j * 0.45, 0);
    portcullis.add(bar);
  }
  portcullis.position.set(0, 0.5, front - 0.45);
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
    windowAt(towers, x, 0.5 + th * 0.45, z + 0.98, 0, 0.22, 0.44, false);
    windowAt(towers, x, 0.5 + th * 0.75, z + 0.98, 0, 0.22, 0.44, z > 0 && x > 0);
    // A window on the outward side as well.
    windowAt(towers, x + Math.sign(x) * 0.98, 0.5 + th * 0.6, z, (Math.sign(x) * Math.PI) / 2, 0.2, 0.4, false);
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
    doorFoot: new THREE.Vector3(0, 0.6, S / 2 + 0.6),
    bridgeTip: new THREE.Vector3(0, 0.6, front + 0.08 + 4.3),
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
