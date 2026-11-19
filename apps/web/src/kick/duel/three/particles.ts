// A pooled GPU particle system: one draw call per kind (fire, smoke, sparks…). Each particle has its own
// velocity, life, size growth, gravity and drag; the shader fades it in and out over its life.
import * as THREE from 'three';

const VERT = /* glsl */ `
  attribute float psize;
  attribute float palpha;
  attribute vec3 pcolor;
  uniform float uScale;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vAlpha = palpha;
    vColor = pcolor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = psize * uScale / max(0.1, -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;
const FRAG = /* glsl */ `
  uniform sampler2D uMap;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec4 t = texture2D(uMap, gl_PointCoord);
    float a = t.a * vAlpha;
    if (a < 0.004) discard;
    gl_FragColor = vec4(vColor * t.rgb, a);
  }
`;

/** A soft round sprite (white, alpha falls off to the edge). */
export function softTexture(hard = 0.2) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(hard, 'rgba(255,255,255,0.85)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export type EmitOptions = {
  life: number;
  size: number;
  color: THREE.ColorRepresentation;
  alpha?: number;
  /** Size change per second (smoke grows, sparks shrink). */
  grow?: number;
  gravity?: number;
  drag?: number;
};

export class Particles {
  readonly points: THREE.Points;
  private readonly n: number;
  private readonly pos: Float32Array;
  private readonly vel: Float32Array;
  private readonly age: Float32Array;
  private readonly life: Float32Array;
  private readonly size: Float32Array;
  private readonly grow: Float32Array;
  private readonly alpha: Float32Array;
  private readonly base: Float32Array;
  private readonly color: Float32Array;
  private readonly gravity: Float32Array;
  private readonly drag: Float32Array;
  private cursor = 0;
  private readonly geo: THREE.BufferGeometry;
  private readonly tmp = new THREE.Color();

  constructor(n: number, map: THREE.Texture, opts: { additive?: boolean; scale?: number } = {}) {
    this.n = n;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.age = new Float32Array(n).fill(1);
    this.life = new Float32Array(n).fill(1);
    this.size = new Float32Array(n);
    this.grow = new Float32Array(n);
    this.alpha = new Float32Array(n);
    this.base = new Float32Array(n);
    this.color = new Float32Array(n * 3);
    this.gravity = new Float32Array(n);
    this.drag = new Float32Array(n);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('psize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('palpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('pcolor', new THREE.BufferAttribute(this.color, 3).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uMap: { value: map }, uScale: { value: opts.scale ?? 300 } },
      transparent: true,
      depthWrite: false,
      blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
  }

  /** The pixel scale follows the canvas height, so particles keep their size on any screen. */
  setScale(px: number) {
    (this.points.material as THREE.ShaderMaterial).uniforms.uScale!.value = px;
  }

  emit(p: THREE.Vector3, v: THREE.Vector3, o: EmitOptions) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.n;
    this.pos.set([p.x, p.y, p.z], i * 3);
    this.vel.set([v.x, v.y, v.z], i * 3);
    this.age[i] = 0;
    this.life[i] = o.life;
    this.size[i] = o.size;
    this.grow[i] = o.grow ?? 0;
    this.base[i] = o.alpha ?? 1;
    this.gravity[i] = o.gravity ?? 0;
    this.drag[i] = o.drag ?? 0;
    this.tmp.set(o.color);
    this.color.set([this.tmp.r, this.tmp.g, this.tmp.b], i * 3);
  }

  /** A burst of `count` particles from `p` in all directions (speed `speed`, a bit upward). */
  burst(p: THREE.Vector3, count: number, speed: number, o: EmitOptions, up = 0.4) {
    const v = new THREE.Vector3();
    for (let k = 0; k < count; k++) {
      v.set(Math.random() * 2 - 1, Math.random() * 2 - 1 + up, Math.random() * 2 - 1).normalize().multiplyScalar(speed * (0.35 + Math.random() * 0.65));
      this.emit(p, v, o);
    }
  }

  update(dt: number) {
    const { n, pos, vel, age, life, size, grow, alpha, base, gravity, drag } = this;
    for (let i = 0; i < n; i++) {
      if (age[i]! >= life[i]!) {
        alpha[i] = 0;
        continue;
      }
      age[i]! += dt;
      const t = Math.min(1, age[i]! / life[i]!);
      const k = i * 3;
      const d = Math.max(0, 1 - drag[i]! * dt);
      vel[k]! *= d;
      vel[k + 1] = vel[k + 1]! * d - gravity[i]! * dt;
      vel[k + 2]! *= d;
      pos[k]! += vel[k]! * dt;
      pos[k + 1]! += vel[k + 1]! * dt;
      pos[k + 2]! += vel[k + 2]! * dt;
      size[i] = Math.max(0, size[i]! + grow[i]! * dt);
      // Quick fade in, long fade out.
      alpha[i] = base[i]! * Math.min(1, t * 8) * (1 - t) ** 1.3;
    }
    const a = this.geo.attributes;
    a.position!.needsUpdate = true;
    a.psize!.needsUpdate = true;
    a.palpha!.needsUpdate = true;
    a.pcolor!.needsUpdate = true;
  }

  dispose() {
    this.geo.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}
