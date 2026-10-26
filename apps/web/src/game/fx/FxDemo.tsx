import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Confetti } from './Confetti';
import { CountUp } from './CountUp';
import { CUES, type Cue } from './cues';
import { play, setSoundEnabled, unlockAudio, useSoundEnabled } from './sound';

/** Dev-only gallery (`/fx-demo`): hear every cue and see each effect without needing a second player. */
const LABEL: Record<Cue, string> = {
  tap: 'نقرة زر',
  pop: 'ظهور (لاعب انضم)',
  ding: 'جرس (غرفة / فريق ثاني)',
  whoosh: 'انتقال شاشة',
  lock: 'تثبيت القرار',
  tick: 'عدّاد: آخر 10 ثواني',
  tickUrgent: 'عدّاد: آخر 3 ثواني',
  boom: 'بداية اللعبة',
  win: 'نقاط لك',
  wrong: 'خسرت نقاط',
  swap: 'مبادلة',
  fanfare: 'النتيجة النهائية',
};

const WORDS = ['جغرافيا', 'أعلام دول', 'معالم', 'كرة قدم'];

export function FxDemo() {
  const on = useSoundEnabled();
  const [round, setRound] = useState(0);
  const [card, setCard] = useState<'win' | 'lose' | null>(null);
  const [confetti, setConfetti] = useState(0);

  const hear = (cue: Cue) => {
    unlockAudio();
    play(cue);
  };
  const sequence = async () => {
    unlockAudio();
    for (const cue of CUES) {
      play(cue);
      await new Promise((r) => setTimeout(r, SCHEDULE_PAUSE[cue]));
    }
  };

  return (
    <div className="dark min-h-dvh bg-q-bg px-4 py-8 font-sans text-white" dir="rtl">
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-2xl font-black text-q-gold">معاينة الأصوات والتأثيرات</h1>
        <p className="text-sm text-white/60">لا موسيقى خلفية: فقط أصوات قصيرة للانتقالات والأحداث. اضغط أي زر لتسمعه.</p>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="rounded-xl bg-q-purple/80 px-4 py-2 text-sm font-bold" onClick={sequence}>
            ▶ شغّل الكل بالتتابع
          </button>
          <button type="button" className="rounded-xl border border-q-line px-4 py-2 text-sm" onClick={() => setSoundEnabled(!on)}>
            {on ? '🔊 الصوت مفعّل' : '🔇 الصوت مكتوم'}
          </button>
        </div>

        <section className="q-card">
          <h2 className="mb-3 text-sm font-bold text-q-cyan">الأصوات</h2>
          <div className="grid grid-cols-2 gap-2">
            {CUES.map((cue) => (
              <button key={cue} type="button" onClick={() => hear(cue)} className="rounded-lg border border-q-line bg-q-bg px-3 py-2.5 text-start text-sm hover:border-q-gold">
                <b className="block text-q-gold">{cue}</b>
                <span className="text-xs text-white/60">{LABEL[cue]}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="q-card">
          <h2 className="mb-3 text-sm font-bold text-q-cyan">لوحة الأسئلة: الخلايا تدخل بمسح قطري</h2>
          <button type="button" className="mb-3 rounded-lg border border-q-line px-3 py-1.5 text-xs" onClick={() => (setRound((n) => n + 1), hear('whoosh'))}>
            أعد العرض
          </button>
          <div key={round} className="grid grid-cols-4 gap-1.5">
            {[100, 200, 300].flatMap((pts, row) =>
              WORDS.map((w, col) => (
                <div
                  key={`${pts}-${w}`}
                  style={{ animationDelay: `${(row + col) * 45}ms` }}
                  className="rounded-lg border border-q-line bg-q-panel py-3 text-center text-sm font-black text-q-gold motion-safe:animate-fx-cell"
                >
                  {pts}
                </div>
              )),
            )}
          </div>
        </section>

        <section className="q-card">
          <h2 className="mb-3 text-sm font-bold text-q-cyan">قرار سرّي: حلقة نبض على الزرين</h2>
          <div className="grid grid-cols-2 gap-2.5">
            <button type="button" className="rounded-xl bg-linear-to-br from-q-red to-[#c0392b] px-3 py-4 text-sm font-black motion-safe:animate-fx-ring">
              🔄 بادل
            </button>
            <button type="button" className="rounded-xl bg-linear-to-br from-q-green to-[#1e8449] px-3 py-4 text-sm font-black motion-safe:animate-fx-ring">
              ✅ جاوب
            </button>
          </div>
        </section>

        <section className="q-card">
          <h2 className="mb-3 text-sm font-bold text-q-cyan">بطاقة النتيجة والعدّاد</h2>
          <div className="mb-3 flex gap-2">
            <button type="button" className="rounded-lg border border-q-gold/60 px-3 py-1.5 text-xs" onClick={() => (setCard('win'), setConfetti((n) => n + 1), hear('win'))}>
              🔥 فزت بنقاط
            </button>
            <button type="button" className="rounded-lg border border-q-red/50 px-3 py-1.5 text-xs" onClick={() => (setCard('lose'), hear('wrong'))}>
              💀 خسرت نقاط
            </button>
          </div>
          {card && (
            <div
              key={`${card}-${confetti}`}
              className={cn(
                'rounded-2xl border bg-q-panel p-5 text-center',
                card === 'win' ? 'border-q-gold/60 motion-safe:animate-fx-win' : 'border-q-red/50 motion-safe:animate-fx-lose',
              )}
            >
              <div className="mb-1 text-5xl motion-safe:animate-fx-drop">{card === 'win' ? '🔥' : '💀'}</div>
              <div className={cn('text-3xl font-black tabular-nums', card === 'win' ? 'text-q-gold' : 'text-q-red')}>
                <bdi dir="ltr">
                  <CountUp to={card === 'win' ? 300 : -200} />
                </bdi>{' '}
                نقطة
              </div>
            </div>
          )}
          {card === 'win' && confetti > 0 && <Confetti key={confetti} />}
        </section>
      </div>
    </div>
  );
}

/** How long to wait before the next cue when playing them all in a row. */
const SCHEDULE_PAUSE: Record<Cue, number> = {
  tap: 350,
  pop: 450,
  ding: 1000,
  whoosh: 600,
  lock: 450,
  tick: 350,
  tickUrgent: 500,
  boom: 900,
  win: 1500,
  wrong: 800,
  swap: 800,
  fanfare: 1900,
};
