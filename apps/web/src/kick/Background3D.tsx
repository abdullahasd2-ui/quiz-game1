import { useEffect, useMemo, useRef, type CSSProperties } from 'react';

const WORDS = ['جاوب', 'بادل', '🔄', '✅', 'نقاط', 'صح', 'غلط', 'دبل'];
// Each cube shows the game on its faces; gold for «جاوب», cyan for «بادل», like the title.
const FACES = [
  { text: 'جاوب', tone: 'gold' },
  { text: 'بادل', tone: 'cyan' },
  { text: '✅', tone: 'gold' },
  { text: '🔄', tone: 'cyan' },
  { text: '؟', tone: 'gold' },
  { text: 'دبل', tone: 'cyan' },
] as const;
const FACE_TRANSFORMS = ['rotateY(0deg)', 'rotateY(180deg)', 'rotateY(90deg)', 'rotateY(-90deg)', 'rotateX(90deg)', 'rotateX(-90deg)'];

/**
 * Behind the Kick pages: the main game's words drifting up, plus 3D cubes with «جاوب / بادل» on their faces
 * that drift up the same way while turning. CSS only, so it costs nothing on a stream PC.
 */
export function Background3D() {
  const words = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        id: i,
        text: WORDS[Math.floor(Math.random() * WORDS.length)],
        style: {
          left: `${Math.random() * 100}%`,
          fontSize: `${12 + Math.random() * 20}px`,
          animationDuration: `${8 + Math.random() * 20}s`,
          animationDelay: `${-Math.random() * 25}s`,
        } as CSSProperties,
      })),
    [],
  );
  const cubes = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const size = 44 + Math.random() * 46;
        return {
          id: i,
          size,
          outer: {
            left: `${(i / 12) * 100 + Math.random() * 6}%`,
            animationDuration: `${16 + Math.random() * 18}s`,
            animationDelay: `${-Math.random() * 30}s`,
          } as CSSProperties,
          inner: { width: size, height: size } as CSSProperties,
          // Degrees per second on each axis; odd cubes turn the other way.
          spin: [8 + Math.random() * 10, 12 + Math.random() * 14, 3 + Math.random() * 5].map((v) => (i % 2 ? -v : v)),
          phase: Math.random() * 360,
        };
      }),
    [],
  );

  // The turning is driven from JS: Safari/WebKit (the iOS app) showed the cubes in 3D but never ran the CSS spin.
  const inners = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const step = (t: number) => {
      const sec = (t - start) / 1000;
      cubes.forEach((c, i) => {
        const el = inners.current[i];
        if (!el) return;
        const [x, y, z] = c.spin as [number, number, number];
        const tr = `rotateX(${c.phase + x * sec}deg) rotateY(${c.phase + y * sec}deg) rotateZ(${z * sec}deg)`;
        el.style.transform = tr;
        el.style.webkitTransform = tr;
      });
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [cubes]);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      {/* Soft colour light in the corners: purple (جاوب) and cyan (بادل) from the title, a little gold in between.
          Radial gradients, not a blur filter: the iOS app dropped the huge blurred layers, the website kept them. */}
      <div className="absolute -top-[25vh] -right-[20vw] size-[75vmax] rounded-full [animation:glow-drift_22s_ease-in-out_infinite]" style={{ background: 'radial-gradient(closest-side, rgba(168,85,247,0.22), rgba(168,85,247,0.08) 55%, transparent)' }} />
      <div className="absolute -bottom-[30vh] -left-[20vw] size-[75vmax] rounded-full [animation:glow-drift_26s_ease-in-out_infinite_reverse]" style={{ background: 'radial-gradient(closest-side, rgba(56,189,248,0.18), rgba(56,189,248,0.06) 55%, transparent)' }} />
      <div className="absolute top-[30vh] left-[25vw] size-[45vmax] rounded-full [animation:glow-drift_30s_ease-in-out_infinite]" style={{ background: 'radial-gradient(closest-side, rgba(247,201,72,0.08), transparent)' }} />
      <div className="absolute inset-0 opacity-10">
        {words.map((w) => (
          <span key={w.id} className="absolute font-black whitespace-nowrap animate-float-word" style={w.style}>
            {w.text}
          </span>
        ))}
      </div>
      {/* Safari/WebKit (the iOS app too) flattens 3D under any ancestor with opacity, and needs the perspective on the cube's
          direct parent, so: no opacity wrapper (the faces are see-through themselves), perspective on each moving holder. */}
      <div className="absolute inset-0">
        {cubes.map((c) => (
          <div key={c.id} className="absolute animate-float-word" style={{ ...c.outer, perspective: 700, WebkitPerspective: 700 }}>
            <div ref={(el) => void (inners.current[c.id] = el)} className="relative" style={{ ...c.inner, transformStyle: 'preserve-3d', WebkitTransformStyle: 'preserve-3d' }}>
              {FACES.map((f, i) => (
                <span
                  key={i}
                  className={
                    'absolute inset-0 grid place-items-center rounded-lg border font-black ' +
                    (f.tone === 'gold' ? 'border-q-gold/60 bg-q-gold/15 text-q-gold' : 'border-q-cyan/60 bg-q-cyan/15 text-q-cyan')
                  }
                  style={{
                    transform: `${FACE_TRANSFORMS[i]} translateZ(${c.size / 2}px)`,
                    WebkitTransform: `${FACE_TRANSFORMS[i]} translateZ(${c.size / 2}px)`,
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    opacity: 0.4,
                    fontSize: c.size * 0.28,
                  }}
                >
                  {f.text}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
