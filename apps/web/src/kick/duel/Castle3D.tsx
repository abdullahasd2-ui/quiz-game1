// The React side of the 3D castle: loads three.js only when it is needed (its own chunk), keeps one scene per
// mounted stage, and feeds it the game on every change. Without WebGL (or with reduced motion) it returns null,
// and the caller shows the drawn (SVG) castles instead.
import { useEffect, useRef, useState } from 'react';
import type { CastleScene, CastleSceneInput } from './three/scene';

let support: boolean | null = null;
const OFF = 'castle3d-off';
/** The GPU dropped the scene (out of memory): every stage switches to the drawn castles for the rest of the visit. */
function turnOff() {
  support = false;
  window.dispatchEvent(new Event(OFF));
}
export function use3D() {
  const [ok, setOk] = useState<boolean | null>(support);
  useEffect(() => {
    const off = () => setOk(false);
    window.addEventListener(OFF, off);
    return () => window.removeEventListener(OFF, off);
  }, []);
  useEffect(() => {
    if (support !== null) return;
    void import('./three/scene').then((m) => {
      support = m.canRender3D();
      setOk(support);
    });
  }, []);
  return ok;
}

export function Castle3D({ input, big, victory = false, className }: { input: CastleSceneInput; big: boolean; victory?: boolean; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<CastleScene | null>(null);
  const latest = useRef(input);
  latest.current = input;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let gone = false;
    let ro: ResizeObserver | null = null;
    void import('./three/scene').then(({ CastleScene }) => {
      if (gone || !canvas.current) return;
      try {
        // Strong devices get the full scene even off the broadcast screen (an iPad, a desktop host page).
        const strong = big || (navigator.hardwareConcurrency ?? 4) >= 6;
        const s = new CastleScene(canvas.current, { quality: strong ? 'high' : 'low', victory, onLost: turnOff });
        scene.current = s;
        s.update(latest.current);
        const el = canvas.current;
        const fit = () => s.resize(el.clientWidth, el.clientHeight);
        fit();
        ro = new ResizeObserver(fit);
        ro.observe(el);
      } catch {
        setFailed(true);
        turnOff();
      }
    });
    return () => {
      gone = true;
      ro?.disconnect();
      scene.current?.dispose();
      scene.current = null;
    };
  }, [big, victory]);

  useEffect(() => {
    scene.current?.update(input);
  }, [input]);

  if (failed) return null;
  return <canvas ref={canvas} className={className ?? 'absolute inset-0 h-full w-full'} aria-hidden />;
}
