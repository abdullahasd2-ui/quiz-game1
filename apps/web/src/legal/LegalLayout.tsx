import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { Link } from 'react-router';

/** Shell for the public pages App Review and players open: privacy policy and support. */
export function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  useEffect(() => {
    document.title = `${title} — جاوب أو بادل`;
  }, [title]);

  return (
    <div className="dark min-h-dvh bg-q-bg font-sans text-white" dir="rtl">
      <main className="mx-auto max-w-[720px] px-4 pt-8 pb-12">
        <Link to="/" className="mb-5 inline-block text-[13px] text-white/50 hover:text-q-gold">
          ← الرجوع للعبة
        </Link>
        <h1 className="mb-5 text-[30px] font-black">
          <span className="text-q-purple">جاوب</span> <span className="text-[22px]">أو</span> <span className="text-q-cyan">بادل</span>
          <span className="mt-1 block text-[18px] font-bold text-q-gold">{title}</span>
        </h1>
        <div className="space-y-4">{children}</div>
      </main>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="q-card">
      <h2 className="mb-2 text-[16px] font-bold text-q-gold">{title}</h2>
      <div className="space-y-2 text-[14px] leading-7 text-white/75">{children}</div>
    </section>
  );
}
