// Materials drawn in code (no image files): stone blocks with mortar and wear, roof tiles, planks.
// Each canvas also serves as a bump map so light catches the joints.
import * as THREE from 'three';

function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

function canvas(w: number, h: number, draw: (g: CanvasRenderingContext2D, rnd: () => number) => void, seed = 7) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!, seeded(seed));
  return c;
}

function texture(c: HTMLCanvasElement, repeat: [number, number], color = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 4;
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
  });
}

export function stoneTextures() {
  const c = stoneCanvas();
  return { map: texture(c, [3, 1.6]), bump: texture(c, [3, 1.6], false) };
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
    g.fillStyle = '#2c2a46';
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 9000; i++) {
      const l = 14 + rnd() * 16;
      g.fillStyle = `hsla(${240 + rnd() * 50}, 25%, ${l}%, 0.5)`;
      g.fillRect(rnd() * 512, rnd() * 512, 2 + rnd() * 3, 2 + rnd() * 3);
    }
  }, 5);
  return texture(c, [12, 12]);
}
