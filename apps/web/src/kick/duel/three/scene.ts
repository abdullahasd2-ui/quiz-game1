// «القلعة» in 3D: the battlefield at night. Two castles face each other on a hill under the moon, in fog.
// The scene only reads the game (`CastleSceneInput`) and turns each change into motion:
//   joins → the castle rises stage by stage, its gate swings open for each newcomer;
//   a question → windows flicker faster, the camera pushes in;
//   a result → fireballs fly from every team that hit, explode on the other castle, roofs fall, fire and smoke grow;
//   the damage a team dealt → its torches of glory light up; the closer a castle is to falling → the redder the sky;
//   the end → the camera circles the winner, its gate opens wide in gold light, fireworks; the loser's castle sinks in dust.
import * as THREE from 'three';
import { aimChains, BRIDGE_UP, buildCastle, waveBanners, waveDrapes, type CastleParts } from './castle';
import { Particles, softTexture } from './particles';
import { World } from './world';

export type Side = 'a' | 'b';
export type CastleSceneInput = {
  hp: Record<Side, number>;
  max: number;
  built: Record<Side, number>;
  torches: Record<Side, number>;
  gateOpen: Record<Side, boolean>;
  alert: boolean;
  /** 0–1: how close the closer castle is to falling. */
  heat: number;
  /** Changes on every new result; with the damage each team dealt. */
  hitKey: string | null;
  dealt: Record<Side, number>;
  winner: Side | 'draw' | null;
};

const TEAM = { a: { light: '#5cc8ff', dark: '#1d4ed8' }, b: { light: '#ff6b8b', dark: '#be123c' } } as const;
const SHOT_S = 0.9;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const damp = (a: number, b: number, k: number, dt: number) => a + (b - a) * (1 - Math.exp(-k * dt));

type Shot = { from: THREE.Vector3; to: THREE.Vector3; t: number; ball: THREE.Mesh; light: THREE.PointLight; target: Side; dmg: number; prev: THREE.Vector3 | null };
type Falling = { mesh: THREE.Mesh; v: THREE.Vector3; w: THREE.Vector3; life: number };

const SKY_VERT = /* glsl */ `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`;
const SKY_FRAG = /* glsl */ `
  uniform float uHeat; uniform float uWin; varying vec3 vP;
  void main(){
    float h = clamp(vP.y * 1.4 + 0.15, 0., 1.);
    vec3 top = vec3(0.03, 0.03, 0.12);
    vec3 mid = vec3(0.12, 0.08, 0.30);
    vec3 hor = mix(vec3(0.32, 0.12, 0.30), vec3(0.75, 0.22, 0.10), uHeat);
    hor = mix(hor, vec3(0.95, 0.70, 0.30), uWin);
    vec3 c = mix(hor, mid, smoothstep(0., .35, h));
    c = mix(c, top, smoothstep(.35, 1., h));
    gl_FragColor = vec4(c, 1.);
  }`;

export class CastleScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 400);
  private readonly castles: Record<Side, CastleParts>;
  private readonly fire: Particles;
  private readonly smoke: Particles;
  private readonly sparks: Particles;
  private readonly dust: Particles;
  private readonly sky: THREE.ShaderMaterial;
  private readonly torchLight: Record<Side, THREE.PointLight>;
  private readonly flash = new THREE.PointLight('#ffb36b', 0, 40, 2);
  private readonly moon: THREE.DirectionalLight;
  private input: CastleSceneInput | null = null;
  private lastHit: string | null = null;
  private shots: Shot[] = [];
  private falling: Falling[] = [];
  private fallen: Record<Side, Set<number>> = { a: new Set(), b: new Set() };
  private shake = 0;
  private shakeCastle: Record<Side, number> = { a: 0, b: 0 };
  private stageScale: Record<Side, number[]> = { a: [0, 0, 0, 0, 0], b: [0, 0, 0, 0, 0] };
  private gate: Record<Side, number> = { a: 0, b: 0 };
  private sink: Record<Side, number> = { a: 0, b: 0 };
  private t = 0;
  private winT = 0;
  private fireworkAt = 0;
  private frame = 0;
  private last = performance.now();
  private readonly still: boolean;
  private readonly glowTex = softTexture(0.02);
  private readonly quality: 'high' | 'low';
  private readonly env: World;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    opts: { quality: 'high' | 'low'; still?: boolean; victory?: boolean },
  ) {
    this.quality = opts.quality;
    this.still = Boolean(opts.still);
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: opts.quality === 'high', alpha: false, powerPreference: 'high-performance' }));
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.quality === 'high' ? 1.5 : 1));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;

    const s = this.scene;
    s.fog = new THREE.FogExp2('#221a52', 0.0115);

    // Sky dome, stars and the moon.
    this.sky = new THREE.ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, uniforms: { uHeat: { value: 0 }, uWin: { value: 0 } }, side: THREE.BackSide, depthWrite: false, fog: false });
    s.add(new THREE.Mesh(new THREE.SphereGeometry(200, 32, 16), this.sky));
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(900 * 3);
    for (let i = 0; i < 900; i++) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.random() * 0.45 * Math.PI;
      starPos.set([Math.cos(th) * Math.cos(ph) * 180, Math.sin(ph) * 180 + 8, Math.sin(th) * Math.cos(ph) * 180], i * 3);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    s.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#dfe6ff', size: 0.9, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 })));
    const moonMesh = new THREE.Mesh(new THREE.SphereGeometry(5, 32, 16), new THREE.MeshBasicMaterial({ color: '#fff4d6', fog: false }));
    moonMesh.position.set(-30, 48, -150);
    s.add(moonMesh);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture(0.05), color: '#ffe9b8', transparent: true, opacity: 0.45, depthWrite: false, fog: false }));
    halo.scale.setScalar(38);
    halo.position.copy(moonMesh.position);
    s.add(halo);

    // Light: cool moonlight with soft shadows, a purple sky fill, and a flash for explosions.
    s.add(new THREE.HemisphereLight('#7d70d8', '#2a2140', 1.1));
    const moon = (this.moon = new THREE.DirectionalLight('#d2dbff', 2.3));
    moon.position.set(-14, 26, 18);
    moon.castShadow = true;
    moon.shadow.mapSize.setScalar(opts.quality === 'high' ? 2048 : 1024);
    const sc = moon.shadow.camera;
    sc.left = -24;
    sc.right = 24;
    sc.top = 18;
    sc.bottom = -10;
    sc.near = 1;
    sc.far = 80;
    moon.shadow.bias = -0.0005;
    moon.shadow.normalBias = 0.03;
    s.add(moon);
    s.add(this.flash);

    // Distant mountains (the ground and everything on it is the World, added with the castles).
    const mountainMat = new THREE.MeshStandardMaterial({ color: '#211a4a', roughness: 1, flatShading: true });
    for (let i = 0; i < 14; i++) {
      const h = 9 + Math.random() * 13;
      const m = new THREE.Mesh(new THREE.ConeGeometry(16 + Math.random() * 14, h, 5 + Math.floor(Math.random() * 3)), mountainMat);
      const a = -Math.PI * 0.95 + (i / 13) * Math.PI * 0.9;
      m.position.set(Math.cos(a) * 150, h / 2 - 6, Math.sin(a) * 120 - 30);
      m.rotation.y = Math.random() * Math.PI;
      s.add(m);
    }

    // The two castles, turned a little toward each other. Blue stands on the right of the screen.
    this.castles = { a: buildCastle(TEAM.a, opts.quality), b: buildCastle(TEAM.b, opts.quality) };
    this.castles.a.root.position.set(10.5, 0, 0);
    this.castles.a.root.rotation.y = -0.42;
    this.castles.b.root.position.set(-10.5, 0, 0);
    this.castles.b.root.rotation.y = 0.42;
    s.add(this.castles.a.root, this.castles.b.root);
    this.env = new World(
      (['a', 'b'] as const).map((t) => ({ position: this.castles[t].root.position.clone(), rotY: this.castles[t].root.rotation.y })),
      opts.quality,
    );
    s.add(this.env.group);
    this.torchLight = { a: new THREE.PointLight('#ff9a3c', 0, 10, 2), b: new THREE.PointLight('#ff9a3c', 0, 10, 2) };
    for (const t of ['a', 'b'] as const) {
      this.torchLight[t].position.set(0, 3.6, 4.2);
      this.castles[t].root.add(this.torchLight[t]);
    }

    // Particles.
    const soft = softTexture(0.15);
    this.fire = new Particles(opts.quality === 'high' ? 1400 : 700, soft, { additive: true });
    this.sparks = new Particles(opts.quality === 'high' ? 1200 : 600, softTexture(0.6), { additive: true });
    this.smoke = new Particles(opts.quality === 'high' ? 700 : 350, soft);
    this.dust = new Particles(500, soft);
    s.add(this.smoke.points, this.dust.points, this.fire.points, this.sparks.points);

    if (opts.victory) {
      // The victory scene starts already built and closer.
      for (const t of ['a', 'b'] as const) this.stageScale[t] = [1, 1, 1, 1, 1];
    }
    this.camera.position.set(0, 26, 60);
    this.loop = this.loop.bind(this);
    this.frame = requestAnimationFrame(this.loop);
  }

  resize(w: number, h: number) {
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Narrow screens see the whole battlefield: a wider lens.
    this.camera.fov = w / h < 1.2 ? 58 : w / h < 1.7 ? 46 : 38;
    this.camera.updateProjectionMatrix();
    const px = h * this.renderer.getPixelRatio() * 0.9;
    for (const p of [this.fire, this.smoke, this.sparks, this.dust, this.env.spray, this.env.mist]) p.setScale(px);
  }

  update(input: CastleSceneInput) {
    const prev = this.input;
    this.input = input;
    // A new result: fireballs from every team that hit.
    if (input.hitKey && input.hitKey !== this.lastHit) {
      if (this.lastHit !== null || prev) {
        for (const from of ['a', 'b'] as const) {
          const dmg = input.dealt[from];
          if (dmg > 0) this.fireShot(from, from === 'a' ? 'b' : 'a', dmg);
        }
      }
      this.lastHit = input.hitKey;
    }
  }

  private world(side: Side, local: THREE.Vector3) {
    return this.castles[side].root.localToWorld(local.clone());
  }

  private fireShot(from: Side, to: Side, dmg: number) {
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.45 + Math.min(0.6, dmg / 40), 16, 12), new THREE.MeshBasicMaterial({ color: '#fff1c2', toneMapped: false }));
    const light = new THREE.PointLight('#ff8a3c', 30, 18, 2);
    ball.add(light);
    // A hot glow around the ball.
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: '#ff9a3c', blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    glow.scale.setScalar(4.5);
    ball.add(glow);
    this.scene.add(ball);
    this.shots.push({ from: this.world(from, this.castles[from].muzzle), to: this.world(to, this.castles[to].target), t: 0, ball, light, target: to, dmg, prev: null });
  }

  private impact(side: Side, at: THREE.Vector3, dmg: number) {
    const big = Math.min(1.6, 0.6 + dmg / 20);
    this.fire.burst(at, Math.round(70 * big), 9 * big, { life: 0.7, size: 2.6, grow: 2, color: '#ffb347', drag: 2.5, gravity: -1 });
    this.sparks.burst(at, Math.round(90 * big), 16 * big, { life: 1.1, size: 0.5, grow: -0.3, color: '#ffe2a0', gravity: 9, drag: 0.6 }, 0.8);
    this.smoke.burst(at, Math.round(26 * big), 3, { life: 2.6, size: 3, grow: 2.4, color: '#3b3346', alpha: 0.7, drag: 1.5, gravity: -1.2 });
    this.dust.burst(new THREE.Vector3(at.x, 0.6, at.z), 24, 4, { life: 2, size: 2.6, grow: 2, color: '#5b5470', alpha: 0.5, drag: 2, gravity: -0.2 }, 0.1);
    this.flash.position.copy(at);
    this.flash.intensity = 160 * big;
    this.shake = Math.min(1.2, this.shake + 0.5 * big);
    this.shakeCastle[side] = 1;
  }

  /** Roofs fall when the life crosses each threshold: two at 50%, four at 25%, the keep at 0. */
  private updateDamage(side: Side) {
    const inp = this.input!;
    const r = inp.hp[side] / inp.max;
    const want = r <= 0 ? 5 : r <= 0.25 ? 4 : r <= 0.5 ? 2 : r <= 0.75 ? 1 : 0;
    const c = this.castles[side];
    for (let i = 0; i < Math.min(want, c.roofs.length); i++) {
      if (this.fallen[side].has(i)) continue;
      this.fallen[side].add(i);
      const roof = c.roofs[i]!;
      const wp = new THREE.Vector3();
      roof.getWorldPosition(wp);
      const wq = new THREE.Quaternion();
      roof.getWorldQuaternion(wq);
      roof.parent!.remove(roof);
      roof.position.copy(wp);
      roof.quaternion.copy(wq);
      this.scene.add(roof);
      const dir = side === 'a' ? 1 : -1;
      this.falling.push({ mesh: roof, v: new THREE.Vector3(dir * (1 + Math.random() * 2), 3 + Math.random() * 2, 1 + Math.random() * 2), w: new THREE.Vector3(Math.random() * 3 - 1.5, Math.random(), Math.random() * 4 - 2), life: 6 });
      this.dust.burst(wp, 20, 3, { life: 1.6, size: 1.6, grow: 1.5, color: '#6a6280', alpha: 0.6, drag: 2 });
    }
  }

  private loop(now: number) {
    this.frame = requestAnimationFrame(this.loop);
    if (document.hidden) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.t += dt;
    const inp = this.input;
    if (!inp) return this.renderer.render(this.scene, this.camera);
    const win = inp.winner && inp.winner !== 'draw' ? inp.winner : null;
    if (inp.winner) this.winT += dt;

    for (const side of ['a', 'b'] as const) {
      const c = this.castles[side];
      // Build stages rise with a spring-like overshoot.
      c.stages.forEach((parts, i) => {
        if (!i) return;
        const target = inp.built[side] >= i ? 1 : 0;
        const cur = (this.stageScale[side][i] = damp(this.stageScale[side][i]!, target, 4.5, dt));
        const s = cur < 0.001 ? 0.0001 : cur;
        for (const p of parts) {
          p.scale.y = s;
          p.visible = cur > 0.002;
        }
      });
      // Gate: doors swing open on their hinges, then the portcullis rises.
      const open = inp.gateOpen[side] || win === side ? 1 : 0;
      this.gate[side] = damp(this.gate[side], open, open ? 2.6 : 3.4, dt);
      // First the drawbridge comes down on its chains (the winches turn), then the doors swing and the portcullis rises.
      const gv = Math.min(1, this.gate[side]);
      const b = ease(Math.min(1, gv * 1.6));
      const g = ease(Math.max(0, Math.min(1, (gv - 0.35) / 0.65)));
      const before = c.bridge.rotation.x;
      c.bridge.rotation.x = -BRIDGE_UP * (1 - b);
      for (const [k, w] of c.wheels.entries()) w.rotation.z += (c.bridge.rotation.x - before) * 6 * (k ? -1 : 1);
      aimChains(c);
      c.doors[0].rotation.y = -g * 1.65;
      c.doors[1].rotation.y = g * 1.65;
      c.portcullis.position.y = 0.5 + Math.max(0, g * 1.25 - 0.25) * 1.6;
      c.inner.intensity = damp(c.inner.intensity, open ? (win === side ? 70 : 30) : 0, 3, dt);
      if (win === side) c.inner.color.set('#ffd27a');
      // Windows: a slow flicker, fast while a question runs, gold for the winner.
      const fl = Math.sin(this.t * (inp.alert ? 9 : 2.3) + (side === 'a' ? 0 : 2)) * 0.35 + Math.sin(this.t * 13.7) * 0.1;
      c.windows.emissiveIntensity = (win === side ? 3 : inp.alert ? 1.8 : 1.1) + fl * 0.6;
      if (win === side) c.windows.emissive.lerp(new THREE.Color('#ffcf6a'), dt);
      c.aura.intensity = damp(c.aura.intensity, win === side ? 40 : inp.alert ? 14 : 7, 2, dt);
      // Torches of glory.
      this.torchLight[side].intensity = damp(this.torchLight[side].intensity, inp.torches[side] * 5, 3, dt) * (0.85 + Math.random() * 0.15);
      for (let i = 0; i < inp.torches[side]; i++) {
        if (Math.random() > (this.quality === 'high' ? 0.7 : 0.4)) continue;
        const p = this.world(side, c.torches[i]!);
        this.fire.emit(p, new THREE.Vector3((Math.random() - 0.5) * 0.4, 1.6 + Math.random(), (Math.random() - 0.5) * 0.4), { life: 0.45, size: 0.9, grow: -1.2, color: Math.random() > 0.3 ? '#ffab40' : '#ffe08a' });
      }
      // Fire and smoke where roofs fell.
      this.updateDamage(side);
      for (const i of this.fallen[side]) {
        const top = this.world(side, c.roofTops[i]!);
        if (Math.random() < 0.9) this.fire.emit(top, new THREE.Vector3((Math.random() - 0.5) * 0.8, 2.6 + Math.random() * 1.5, (Math.random() - 0.5) * 0.8), { life: 0.6, size: 1.8, grow: -1.4, color: Math.random() > 0.4 ? '#ff7a2f' : '#ffd166', drag: 0.5 });
        if (Math.random() < 0.35) this.smoke.emit(top.clone().add(new THREE.Vector3(0, 1.2, 0)), new THREE.Vector3((Math.random() - 0.5) * 0.6 + 0.4, 1.8 + Math.random(), (Math.random() - 0.5) * 0.6), { life: 3.5, size: 2, grow: 2.2, color: '#2c2638', alpha: 0.55, drag: 0.2 });
      }
      // The fallen castle sinks into its own dust.
      const down = inp.hp[side] <= 0 ? 1 : 0;
      this.sink[side] = damp(this.sink[side], down, 0.8, dt);
      c.root.position.y = -this.sink[side] * 3.2;
      c.root.rotation.z = (side === 'a' ? 1 : -1) * this.sink[side] * 0.08;
      if (down && this.sink[side] < 0.9 && Math.random() < 0.6) {
        this.dust.emit(this.world(side, new THREE.Vector3((Math.random() - 0.5) * 8, 0.5, (Math.random() - 0.5) * 8)), new THREE.Vector3(0, 1 + Math.random(), 0), { life: 2.4, size: 3, grow: 2.5, color: '#4e4766', alpha: 0.6, drag: 1 });
      }
      // Hit shake.
      if (this.shakeCastle[side] > 0) {
        this.shakeCastle[side] = Math.max(0, this.shakeCastle[side] - dt * 1.8);
        const k = this.shakeCastle[side] ** 2;
        c.root.position.x = (side === 'a' ? 10.5 : -10.5) + Math.sin(this.t * 60) * 0.18 * k;
      }
      waveBanners(c.banners, this.t, inp.alert ? 1.4 : 1);
      waveDrapes(c.drapes, this.t, inp.alert ? 1.4 : 1);
    }

    // Fireballs along their arc, with a trail.
    for (const sh of this.shots) {
      sh.t += dt / SHOT_S;
      const t = Math.min(1, sh.t);
      const p = sh.from.clone().lerp(sh.to, t);
      p.y += Math.sin(t * Math.PI) * 7.5;
      sh.ball.position.copy(p);
      sh.light.intensity = 30 + Math.sin(this.t * 40) * 6;
      // The trail fills the whole path flown since the last frame, so it is continuous at any frame rate.
      const from = sh.prev ?? p;
      const steps = Math.max(3, Math.ceil(from.distanceTo(p) / 0.25));
      for (let k = 0; k < steps; k++) {
        const q = from.clone().lerp(p, k / steps);
        this.fire.emit(q, new THREE.Vector3((Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8 + 0.4, (Math.random() - 0.5) * 0.8), { life: 0.55, size: 2.6, grow: -3, color: k % 3 ? '#ff7a2f' : '#ffd28a', alpha: 0.7 });
      }
      sh.prev = p.clone();
      if (Math.random() < 0.6) this.smoke.emit(p, new THREE.Vector3(0, 0.6, 0), { life: 1.4, size: 1.4, grow: 1.6, color: '#3a3044', alpha: 0.4 });
      if (t >= 1) {
        this.impact(sh.target, sh.to, sh.dmg);
        this.scene.remove(sh.ball);
        sh.ball.geometry.dispose();
      }
    }
    this.shots = this.shots.filter((s) => s.t < 1);

    // Falling roofs: gravity, tumbling, a bounce, then gone.
    for (const f of this.falling) {
      f.life -= dt;
      f.v.y -= 18 * dt;
      f.mesh.position.addScaledVector(f.v, dt);
      f.mesh.rotation.x += f.w.x * dt;
      f.mesh.rotation.z += f.w.z * dt;
      if (f.mesh.position.y < 0.6) {
        f.mesh.position.y = 0.6;
        if (Math.abs(f.v.y) > 2) this.dust.burst(f.mesh.position, 12, 2.5, { life: 1.4, size: 1.6, grow: 1.6, color: '#5d5675', alpha: 0.6, drag: 2 }, 0.2);
        f.v.y *= -0.25;
        f.v.x *= 0.5;
        f.v.z *= 0.5;
        f.w.multiplyScalar(0.5);
      }
      if (f.life < 1) f.mesh.scale.multiplyScalar(1 - dt);
    }
    for (const f of this.falling.filter((x) => x.life <= 0)) this.scene.remove(f.mesh);
    this.falling = this.falling.filter((x) => x.life > 0);

    // Victory fireworks over the winner.
    if (win && this.t > this.fireworkAt) {
      this.fireworkAt = this.t + 0.35 + Math.random() * 0.4;
      const base = this.castles[win].root.position;
      const at = new THREE.Vector3(base.x + (Math.random() - 0.5) * 14, 12 + Math.random() * 8, base.z - 4 + (Math.random() - 0.5) * 8);
      const col = [TEAM[win].light, '#f7c948', '#ffffff', '#ff9f43'][Math.floor(Math.random() * 4)]!;
      this.sparks.burst(at, 120, 9, { life: 1.8, size: 0.7, grow: -0.25, color: col, gravity: 3.5, drag: 1.1 }, 0);
      this.flash.position.copy(at);
      this.flash.color.set(col);
      this.flash.intensity = 90;
    }

    // Ambient embers drifting over the field.
    if (Math.random() < (this.quality === 'high' ? 0.5 : 0.25)) {
      this.sparks.emit(new THREE.Vector3((Math.random() - 0.5) * 40, 0.5, (Math.random() - 0.5) * 16), new THREE.Vector3((Math.random() - 0.5) * 0.6, 1 + Math.random(), 0), { life: 4, size: 0.35, color: '#ffb347', alpha: 0.8 });
    }

    for (const p of [this.fire, this.smoke, this.sparks, this.dust]) p.update(dt);
    this.env.update(this.t, dt, inp.alert ? 1 : 0);
    this.flash.intensity = damp(this.flash.intensity, 0, 7, dt);
    this.sky.uniforms.uHeat!.value = damp(this.sky.uniforms.uHeat!.value as number, inp.heat, 1, dt);
    this.sky.uniforms.uWin!.value = damp(this.sky.uniforms.uWin!.value as number, win ? 0.55 : 0, 0.7, dt);
    this.moon.intensity = win ? damp(this.moon.intensity, 2.2, 1, dt) : 1.6;

    this.updateCamera(dt, win);
    this.renderer.render(this.scene, this.camera);
  }

  private camPos = new THREE.Vector3(0, 26, 60);
  private camLook = new THREE.Vector3(0, 3, 0);

  private updateCamera(dt: number, win: Side | null) {
    const inp = this.input!;
    const pos = new THREE.Vector3();
    const look = new THREE.Vector3(0, 3.4, 0);
    if (win) {
      // Victory: a slow crane around the winner, starting wide and closing in on its open gate.
      const c = this.castles[win].root.position;
      const a = (win === 'a' ? -0.55 : 0.55) + Math.sin(this.winT * 0.18) * 0.5;
      const r = Math.max(15, 26 - this.winT * 2.5);
      pos.set(c.x + Math.sin(a) * r, 4.5 + Math.max(0, 9 - this.winT * 1.4), c.z + Math.cos(a) * r);
      look.set(c.x * 0.92, 3.8, c.z);
    } else {
      // The establishing shot slides in once, then the camera breathes; a question pushes in a little.
      const intro = Math.min(1, this.t / 2.8);
      const e = ease(intro);
      const push = inp.alert ? 1 : 0;
      pos.set(Math.sin(this.t * 0.11) * 1.4, THREE.MathUtils.lerp(24, 6.6 - push * 0.5, e), THREE.MathUtils.lerp(62, 23.5 - push * 2, e));
      // Follow the flying fireballs a little.
      if (this.shots.length) look.x = this.shots[0]!.ball.position.x * 0.25;
    }
    const k = this.still ? 50 : win ? 1.4 : 2.2;
    this.camPos.set(damp(this.camPos.x, pos.x, k, dt), damp(this.camPos.y, pos.y, k, dt), damp(this.camPos.z, pos.z, k, dt));
    this.camLook.set(damp(this.camLook.x, look.x, k, dt), damp(this.camLook.y, look.y, k, dt), damp(this.camLook.z, look.z, k, dt));
    this.shake = Math.max(0, this.shake - dt * 2.4);
    const s = this.still ? 0 : this.shake ** 2 * 0.5;
    this.camera.position.set(this.camPos.x + (Math.random() - 0.5) * s, this.camPos.y + (Math.random() - 0.5) * s, this.camPos.z);
    this.camera.lookAt(this.camLook);
  }

  dispose() {
    cancelAnimationFrame(this.frame);
    for (const p of [this.fire, this.smoke, this.sparks, this.dust, this.env.spray, this.env.mist]) p.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
    this.renderer.dispose();
  }
}

/** Can this browser draw it? (A WebGL context, and the person has not asked for less motion.) */
export function canRender3D() {
  try {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
