// Materials drawn in code (no image files): stone blocks with mortar and wear, roof tiles, planks.
// Each canvas also serves as a bump map so light catches the joints.
import * as THREE from 'three';

function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

const TEX_SCALE = 2;

function canvas(w: number, h: number, draw: (g: CanvasRenderingContext2D, rnd: () => number) => void, seed = 7) {
  // Drawn at twice the design size: crisp up close on Retina screens, sharp enough for the derived normal maps.
  const c = document.createElement('canvas');
  c.width = w * TEX_SCALE;
  c.height = h * TEX_SCALE;
  const g = c.getContext('2d')!;
  g.scale(TEX_SCALE, TEX_SCALE);
  draw(g, seeded(seed));
  return c;
}

function texture(c: HTMLCanvasElement, repeat: [number, number], color = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 8;
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Cut stone: staggered blocks, each a slightly different grey, darker mortar, speckles and moss at the base. */
export function stoneCanvas() {
  return canvas(512, 512, (g, rnd) => {
    g.fillStyle = '#3a3a48';
    g.fillRect(0, 0, 512, 512);
    const rows = 10;
    const h = 512 / rows;
    for (let r = 0; r < rows; r++) {
      let x = r % 2 ? -h * 0.9 : 0;
      while (x < 512) {
        const w = h * (1.4 + rnd() * 1.1);
        const l = 40 + rnd() * 26;
        g.fillStyle = `hsl(${220 + rnd() * 40}, ${4 + rnd() * 6}%, ${l}%)`;
        g.fillRect(x + 3, r * h + 3, w - 6, h - 6);
        // A light top edge and a dark bottom edge: a bevel.
        g.fillStyle = 'rgba(255,255,255,0.08)';
        g.fillRect(x + 3, r * h + 3, w - 6, 3);
        g.fillStyle = 'rgba(0,0,0,0.25)';
        g.fillRect(x + 3, r * h + h - 6, w - 6, 3);
        x += w;
      }
    }
    for (let i = 0; i < 4000; i++) {
      g.fillStyle = `rgba(${rnd() > 0.5 ? '255,255,255' : '0,0,0'},${rnd() * 0.08})`;
      g.fillRect(rnd() * 512, rnd() * 512, 2, 2);
    }
    // Chipped corners and cracks.
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    for (let i = 0; i < 26; i++) {
      let x = rnd() * 512;
      let y = rnd() * 512;
      g.lineWidth = 0.8 + rnd();
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 4; k++) g.lineTo((x += rnd() * 16 - 8), (y += rnd() * 14));
      g.stroke();
    }
    // Rain streaks: darker vertical grime under the joints.
    for (let i = 0; i < 70; i++) {
      const x = rnd() * 512;
      const y = rnd() * 512;
      const grad = g.createLinearGradient(0, y, 0, y + 60 + rnd() * 80);
      grad.addColorStop(0, 'rgba(10,12,20,0.22)');
      grad.addColorStop(1, 'rgba(10,12,20,0)');
      g.fillStyle = grad;
      g.fillRect(x, y, 3 + rnd() * 6, 140);
    }
    // Moss in a few joints.
    for (let i = 0; i < 90; i++) {
      g.fillStyle = `hsla(${95 + rnd() * 40}, 35%, ${22 + rnd() * 12}%, ${0.25 + rnd() * 0.3})`;
      g.beginPath();
      g.arc(rnd() * 512, (Math.floor(rnd() * 10) + 1) * 51.2 - 2, 2 + rnd() * 6, 0, Math.PI * 2);
      g.fill();
    }
  });
}

/** A tangent-space normal map from a canvas's brightness (bright = raised), and a roughness map (joints rougher). */
export function derivedMaps(c: HTMLCanvasElement, repeat: [number, number], strength = 3) {
  const w = c.width;
  const h = c.height;
  const src = c.getContext('2d')!.getImageData(0, 0, w, h).data;
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) lum[i] = (src[i * 4]! * 0.3 + src[i * 4 + 1]! * 0.59 + src[i * 4 + 2]! * 0.11) / 255;
  const nc = document.createElement('canvas');
  nc.width = w;
  nc.height = h;
  const rc = document.createElement('canvas');
  rc.width = w;
  rc.height = h;
  const nd = nc.getContext('2d')!.createImageData(w, h);
  const rd = rc.getContext('2d')!.createImageData(w, h);
  const at = (x: number, y: number) => lum[((y + h) % h) * w + ((x + w) % w)]!;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const l = Math.hypot(dx, dy, 1);
      const i = (y * w + x) * 4;
      nd.data[i] = (-dx / l) * 127 + 128;
      nd.data[i + 1] = (dy / l) * 127 + 128;
      nd.data[i + 2] = (1 / l) * 127 + 128;
      nd.data[i + 3] = 255;
      const r = 150 + (1 - at(x, y)) * 105;
      rd.data[i] = rd.data[i + 1] = rd.data[i + 2] = Math.min(255, r);
      rd.data[i + 3] = 255;
    }
  nc.getContext('2d')!.putImageData(nd, 0, 0);
  rc.getContext('2d')!.putImageData(rd, 0, 0);
  return { normal: texture(nc, repeat, false), rough: texture(rc, repeat, false) };
}

export function stoneTextures() {
  const c = stoneCanvas();
  return { map: texture(c, [3, 1.6]), bump: texture(c, [3, 1.6], false), ...derivedMaps(c, [3, 1.6], 4) };
}

/** Roof tiles in the team colour: rows of rounded scales, each row shadowed by the one above. */
export function roofTexture(color: string) {
  const c = canvas(256, 256, (g, rnd) => {
    g.fillStyle = color;
    g.fillRect(0, 0, 256, 256);
    const s = 32;
    for (let y = 0; y < 256 + s; y += s * 0.6) {
      for (let x = (y / (s * 0.6)) % 2 ? -s / 2 : 0; x < 256 + s; x += s) {
        g.beginPath();
        g.arc(x + s / 2, y, s / 2, 0, Math.PI);
        g.fillStyle = `rgba(0,0,0,${0.18 + rnd() * 0.12})`;
        g.fill();
        g.beginPath();
        g.arc(x + s / 2, y - 2, s / 2 - 2, 0, Math.PI);
        g.fillStyle = `rgba(255,255,255,${0.05 + rnd() * 0.08})`;
        g.fill();
      }
    }
  }, 11);
  return texture(c, [3, 2]);
}

/** Oak planks with grain and iron studs, for the gate doors. */
export function woodTexture() {
  const c = canvas(256, 256, (g, rnd) => {
    for (let i = 0; i < 6; i++) {
      g.fillStyle = `hsl(28, ${40 + rnd() * 10}%, ${18 + rnd() * 8}%)`;
      g.fillRect(i * 43, 0, 42, 256);
      for (let k = 0; k < 30; k++) {
        g.strokeStyle = `rgba(0,0,0,${0.15 + rnd() * 0.2})`;
        g.beginPath();
        const x = i * 43 + rnd() * 42;
        g.moveTo(x, 0);
        g.bezierCurveTo(x + rnd() * 6 - 3, 90, x + rnd() * 6 - 3, 170, x + rnd() * 4 - 2, 256);
        g.stroke();
      }
    }
    g.fillStyle = '#2b2b33';
    g.fillRect(0, 40, 256, 14);
    g.fillRect(0, 200, 256, 14);
    g.fillStyle = '#8a8a99';
    for (let x = 12; x < 256; x += 28) {
      g.beginPath();
      g.arc(x, 47, 3.5, 0, Math.PI * 2);
      g.arc(x, 207, 3.5, 0, Math.PI * 2);
      g.fill();
    }
  }, 3);
  return texture(c, [1, 1]);
}

/** The ground: dark grass and dirt, softly noisy. */
export function groundTexture() {
  const c = canvas(512, 512, (g, rnd) => {
    g.fillStyle = '#25303a';
    g.fillRect(0, 0, 512, 512);
    // Large soft patches: grass and bare earth.
    for (let i = 0; i < 60; i++) {
      const x = rnd() * 512;
      const y = rnd() * 512;
      const r = 30 + rnd() * 70;
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      const earth = rnd() > 0.65;
      grad.addColorStop(0, earth ? 'rgba(60,48,62,0.5)' : `hsla(${150 + rnd() * 40}, 30%, ${20 + rnd() * 8}%, 0.55)`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 14000; i++) {
      const l = 14 + rnd() * 20;
      g.fillStyle = `hsla(${rnd() > 0.7 ? 250 + rnd() * 30 : 140 + rnd() * 50}, 28%, ${l}%, 0.5)`;
      g.fillRect(rnd() * 512, rnd() * 512, 1 + rnd() * 2, 2 + rnd() * 4);
    }
  }, 5);
  return texture(c, [12, 12]);
}

/** Cobblestones for the roads and the plaza: rounded stones of varied size, dark joints, a little moss. */
export function cobbleTexture(repeat: [number, number]) {
  const c = canvas(512, 512, (g, rnd) => {
    g.fillStyle = '#1b1a26';
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 520; i++) {
      const x = rnd() * 512;
      const y = rnd() * 512;
      const r = 9 + rnd() * 13;
      const l = 30 + rnd() * 22;
      for (const [dx, dy] of [[0, 0], [512, 0], [-512, 0], [0, 512], [0, -512]] as const) {
        const grad = g.createRadialGradient(x + dx - r * 0.3, y + dy - r * 0.3, 1, x + dx, y + dy, r);
        grad.addColorStop(0, `hsl(${235 + rnd() * 30}, 8%, ${l + 10}%)`);
        grad.addColorStop(1, `hsl(${235 + rnd() * 30}, 8%, ${l - 12}%)`);
        g.fillStyle = grad;
        g.beginPath();
        g.ellipse(x + dx, y + dy, r, r * (0.75 + rnd() * 0.25), rnd() * 3, 0, Math.PI * 2);
        g.fill();
      }
    }
    for (let i = 0; i < 160; i++) {
      g.fillStyle = `hsla(${100 + rnd() * 30}, 35%, 22%, ${0.2 + rnd() * 0.25})`;
      g.fillRect(rnd() * 512, rnd() * 512, 2 + rnd() * 5, 2 + rnd() * 5);
    }
  }, 19);
  return { map: texture(c, repeat), bump: texture(c, repeat, false), ...derivedMaps(c, repeat, 5) };
}

/** Plain planks for the drawbridge deck: long boards, iron straps. */
export function planksTexture() {
  const c = canvas(256, 256, (g, rnd) => {
    for (let i = 0; i < 8; i++) {
      g.fillStyle = `hsl(26, ${35 + rnd() * 12}%, ${16 + rnd() * 9}%)`;
      g.fillRect(0, i * 32, 256, 31);
      for (let k = 0; k < 14; k++) {
        g.strokeStyle = `rgba(0,0,0,${0.12 + rnd() * 0.2})`;
        g.beginPath();
        const y = i * 32 + rnd() * 30;
        g.moveTo(0, y);
        g.bezierCurveTo(90, y + rnd() * 4 - 2, 170, y + rnd() * 4 - 2, 256, y + rnd() * 3);
        g.stroke();
      }
    }
    g.fillStyle = '#26262e';
    g.fillRect(30, 0, 12, 256);
    g.fillRect(214, 0, 12, 256);
  }, 23);
  return texture(c, [1, 2]);
}
