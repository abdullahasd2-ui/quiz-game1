// Water that reads as water: three scrolling layers of a tileable wave normal map, Fresnel reflection of a real
// capture of the scene (sky, castles, trees) taken from the garden, colour absorbed with depth (clear and teal in the
// shallows, ink-blue in the deep, so the caustic-lit bed shows through at the edges), lapping foam lines along every
// shore, the moon's glitter path and the lanterns' streaks. The waterfall is its own layered, foaming sheet.
import * as THREE from 'three';

/** A tileable wave texture: rgb = normal, a = height (used for foam break-up). */
export function waveTexture(size = 256) {
  const data = new Uint8Array(size * size * 4);
  const h = new Float32Array(size * size);
  // Sum of plane waves with integer frequencies: tiles seamlessly.
  const waves: [number, number, number, number][] = [];
  let s = 11;
  const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < 28; i++) {
    const f = 1 + Math.floor(rnd() * (i < 8 ? 4 : i < 18 ? 9 : 18));
    const a = rnd() * Math.PI * 2;
    waves.push([Math.round(Math.cos(a) * f), Math.round(Math.sin(a) * f), rnd() * 6.28, 1 / (0.6 + f)]);
  }
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let v = 0;
      for (const [kx, ky, ph, amp] of waves) v += Math.sin(((kx * x + ky * y) / size) * Math.PI * 2 + ph) * amp;
      // Sharpen the crests a little, like real wind ripples.
      h[y * size + x] = Math.sign(v) * Math.pow(Math.abs(v), 0.85);
    }
  let mn = Infinity;
  let mx = -Infinity;
  for (const v of h) {
    mn = Math.min(mn, v);
    mx = Math.max(mx, v);
  }
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const at = (xx: number, yy: number) => h[((yy + size) % size) * size + ((xx + size) % size)]!;
      const dx = (at(x + 1, y) - at(x - 1, y)) * 0.9;
      const dy = (at(x, y + 1) - at(x, y - 1)) * 0.9;
      const n = new THREE.Vector3(-dx, -dy, 1).normalize();
      const i = (y * size + x) * 4;
      data[i] = (n.x * 0.5 + 0.5) * 255;
      data[i + 1] = (n.y * 0.5 + 0.5) * 255;
      data[i + 2] = (n.z * 0.5 + 0.5) * 255;
      data[i + 3] = ((at(x, y) - mn) / (mx - mn)) * 255;
    }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

export const MAX_GLINTS = 8;

export type WaterShared = {
  time: { value: number };
  waves: THREE.Texture;
  env: { value: THREE.Texture | null };
  hasEnv: { value: number };
  glints: { value: THREE.Vector3[] };
  glintCount: { value: number };
};

const VERT = /* glsl */ `
  attribute float depth;
  uniform float uTime; uniform float uAmp;
  varying vec3 vW; varying float vDepth;
  #include <fog_pars_vertex>
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.);
    // Slow swell: tiny, so the surface breathes without leaving its banks.
    w.y += (sin(w.x * 0.9 + uTime * 0.8) * cos(w.z * 0.7 - uTime * 0.6) + 0.5 * sin((w.x + w.z) * 1.7 + uTime * 1.3)) * 0.018 * uAmp;
    vW = w.xyz;
    vDepth = depth;
    vec4 mvPosition = viewMatrix * w;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;

const FRAG = /* glsl */ `
  uniform float uTime; uniform sampler2D uWaves; uniform samplerCube uEnv; uniform float uHasEnv;
  uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uSkyHor; uniform vec3 uSkyTop; uniform vec3 uMoonDir;
  uniform vec3 uGlints[${MAX_GLINTS}]; uniform int uGlintCount; uniform float uScale; uniform float uFoam; uniform vec2 uFlow;
  uniform float uClarity;
  varying vec3 vW; varying float vDepth;
  #include <fog_pars_fragment>
  void main() {
    vec2 p = vW.xz * uScale;
    float t = uTime;
    vec4 a = texture2D(uWaves, p * 0.11 + vec2(0.021, 0.013) * t + uFlow * t * 0.05);
    vec4 b = texture2D(uWaves, p * 0.27 + vec2(-0.033, 0.029) * t + uFlow * t * 0.09);
    vec4 c = texture2D(uWaves, p * 0.71 + vec2(0.047, -0.041) * t);
    vec2 slope = (a.xy * 2. - 1.) * 0.55 + (b.xy * 2. - 1.) * 0.4 + (c.xy * 2. - 1.) * 0.22;
    vec3 N = normalize(vec3(slope.x, 1.0, slope.y));
    vec3 V = normalize(cameraPosition - vW);
    float NdV = max(dot(N, V), 0.);
    float fres = 0.02 + 0.98 * pow(1. - NdV, 5.);
    // Reflection: the captured scene, nudged by the ripples; a sky gradient if there is no capture yet.
    vec3 R = reflect(-V, N);
    R.y = abs(R.y);
    vec3 sky = mix(uSkyHor, uSkyTop, smoothstep(0., 0.6, R.y));
    vec3 refl = uHasEnv > 0.5 ? textureCube(uEnv, normalize(R + vec3(slope.x, 0., slope.y) * 0.06)).rgb : sky;
    // Body colour from depth: light travels further through deep water and comes back darker and bluer.
    float d = max(vDepth, 0.);
    float absorb = 1. - exp(-d * 4.2 / uClarity);
    vec3 body = mix(uShallow, uDeep, absorb);
    // Light scattered up from under the surface where the waves face the viewer.
    body += uShallow * 0.25 * pow(max(dot(N, -uMoonDir * vec3(1., -1., 1.)), 0.), 3.) * (1. - absorb);
    vec3 col = mix(body, refl, fres);
    // The moon's glitter path and the lanterns' warm streaks.
    vec3 H = normalize(uMoonDir + V);
    col += vec3(1., 0.95, 0.85) * (pow(max(dot(N, H), 0.), 600.) * 4. + pow(max(dot(N, H), 0.), 60.) * 0.12);
    for (int i = 0; i < ${MAX_GLINTS}; i++) {
      if (i >= uGlintCount) break;
      vec3 Lv = uGlints[i] - vW;
      float dist = length(Lv);
      vec3 Hl = normalize(Lv / dist + V);
      float s = pow(max(dot(N, Hl), 0.), 180.) * 3.5 / (1. + dist * dist * 0.02);
      col += vec3(1., 0.66, 0.32) * s;
    }
    // Foam: lapping lines that run along the shore and break up in the waves.
    float shore = 1. - smoothstep(0.0, 0.16 * uFoam, d);
    float lap = sin(d * 55. - t * 2.2 + a.w * 6.) * 0.5 + 0.5;
    float foam = shore * smoothstep(0.35, 0.8, lap * 0.6 + b.w * 0.7) + smoothstep(0.03, 0., d) * 0.8;
    foam *= uFoam > 0. ? 1. : 0.;
    col = mix(col, vec3(0.82, 0.86, 0.95) * 0.75, clamp(foam, 0., 1.) * 0.85);
    float alpha = mix(0.35, 0.97, absorb);
    alpha = max(alpha, fres * 0.95);
    alpha = max(alpha, clamp(foam, 0., 1.) * 0.9);
    alpha *= smoothstep(-0.01, 0.025, d);
    gl_FragColor = vec4(col, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }`;

/** A water material. Geometry must carry a `depth` attribute (water level minus the ground below, per vertex). */
export function waterMaterial(shared: WaterShared, o: { deep?: string; shallow?: string; scale?: number; foam?: number; flow?: [number, number]; clarity?: number; amp?: number } = {}) {
  const m = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uTime: shared.time,
      uWaves: { value: shared.waves },
      uEnv: shared.env as THREE.IUniform,
      uHasEnv: shared.hasEnv,
      uDeep: { value: new THREE.Color(o.deep ?? '#06102a') },
      uShallow: { value: new THREE.Color(o.shallow ?? '#2f6f7a') },
      uSkyHor: { value: new THREE.Color('#5a2f5e') },
      uSkyTop: { value: new THREE.Color('#0d0c2a') },
      uMoonDir: { value: new THREE.Vector3(-30, 48, -150).normalize() },
      uGlints: shared.glints,
      uGlintCount: shared.glintCount,
      uScale: { value: o.scale ?? 1 },
      uFoam: { value: o.foam ?? 1 },
      uFlow: { value: new THREE.Vector2(...(o.flow ?? [0, 0])) },
      uClarity: { value: o.clarity ?? 1 },
      uAmp: { value: o.amp ?? 1 },
    },
    transparent: true,
    depthWrite: false,
    fog: true,
  });
  return m;
}

/** Gives a flat water mesh (built in the xz-plane at height `level`) its per-vertex depth from the ground function. */
export function bakeDepth(geo: THREE.BufferGeometry, level: number, ground: (x: number, z: number) => number, origin = new THREE.Vector3()) {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const d = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) d[i] = level - ground(pos.getX(i) + origin.x, pos.getZ(i) + origin.z);
  geo.setAttribute('depth', new THREE.BufferAttribute(d, 1));
  return geo;
}

/** The falling sheet: streaks that stretch as the water speeds up, ragged edges, a white boil at the foot. */
export function fallsMaterial(shared: WaterShared) {
  return new THREE.ShaderMaterial({
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: shared.time, uWaves: { value: shared.waves } },
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec2 vUv;
      void main() { vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform sampler2D uWaves; varying vec2 vUv;
      #include <fog_pars_fragment>
      void main() {
        // Falling: the texture runs down, stretched more the lower (faster) it is.
        float fall = 1. - vUv.y;
        float stretch = mix(0.6, 0.2, fall);
        vec4 n1 = texture2D(uWaves, vec2(vUv.x * 1.6, vUv.y * stretch + uTime * 0.55));
        vec4 n2 = texture2D(uWaves, vec2(vUv.x * 3.1 + 0.37, vUv.y * stretch * 1.7 + uTime * 0.9));
        float streak = pow(n1.w * 0.6 + n2.w * 0.5, 2.2);
        float edge = smoothstep(0., 0.16 + n2.w * 0.1, vUv.x) * smoothstep(1., 0.84 - n1.w * 0.1, vUv.x);
        vec3 c = mix(vec3(0.22, 0.32, 0.6), vec3(0.88, 0.93, 1.), streak);
        float lip = smoothstep(0.93, 1., vUv.y);
        float boil = smoothstep(0.16, 0., vUv.y);
        c = mix(c, vec3(0.95), max(lip * 0.5, boil * (0.6 + n2.w * 0.4)));
        float a = (0.5 + streak * 0.5) * edge;
        a = max(a, boil * edge * 0.95);
        gl_FragColor = vec4(c, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    fog: true,
    side: THREE.DoubleSide,
  });
}
