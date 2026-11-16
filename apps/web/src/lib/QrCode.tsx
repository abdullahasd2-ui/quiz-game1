import QR from 'qrcode';
import { useEffect, useState } from 'react';
import { cn } from './utils';

/** A QR code for a link (dark on white so every phone camera reads it), drawn as SVG. */
export function QrCode({ text, className, label }: { text: string; className?: string; label?: string }) {
  const [svg, setSvg] = useState('');
  useEffect(() => {
    let gone = false;
    QR.toString(text, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0b0b1a', light: '#ffffff' } })
      .then((s) => !gone && setSvg(s))
      .catch(() => !gone && setSvg(''));
    return () => {
      gone = true;
    };
  }, [text]);
  if (!svg) return null;
  return (
    <figure className={cn('inline-flex flex-col items-center gap-1.5', className)}>
      <div role="img" aria-label={label ?? 'رمز QR للدخول'} className="w-full overflow-hidden rounded-xl bg-white p-1.5 shadow-lg [&_svg]:block [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
      {label && <figcaption className="text-center text-xs font-bold text-white/70">{label}</figcaption>}
    </figure>
  );
}
