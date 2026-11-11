import type { StreamVariant } from '@quiz/shared';
import { useState } from 'react';
import { Modal } from '@/game/ui';
import { cn } from '@/lib/utils';

/** The viewers' rules, as typed in the chat. Shared by the streamer's setup page and the broadcast screen. */
export const VIEWER_STEPS: { icon: string; title: string; text: string }[] = [
  { icon: '👋', title: 'ادخل', text: 'اكتب «دخول» في الشات. وللطلعة «خروج».' },
  { icon: '🎙️', title: 'الستريمر أول', text: 'يجاوب أو يختار واحد منكم — واختياره مخفي.' },
  { icon: '1️⃣', title: 'اختر', text: 'اكتب رقم اختيارك (1 أو 2 أو 3 حسب الطور).' },
  { icon: '✍️', title: 'جاوب', text: 'اكتب رقم الجواب (1-4) أو الجواب نفسه.' },
  { icon: '📊', title: 'نقاطي', text: 'اكتب «نقاطي» وتطلع نقاطك على الشاشة.' },
];

/** Each stream game has its own scoring, shown as its own section. */
export const MODE_RULES: { variant: StreamVariant; title: string; tone: string; lines: string[] }[] = [
  {
    variant: 'swap',
    title: '🔄 جاوب أو بادل',
    tone: 'border-q-cyan/35 bg-q-cyan/10 text-q-cyan',
    lines: [
      '1 = جاوب: صح تاخذ النقاط.',
      '2 = بادل: تاخذ جواب الستريمر — صح دبل، غلط ينقص منك.',
      'لو الستريمر بادل معك: جوابك له، وأنت ما تاخذ شي.',
    ],
  },
  {
    variant: 'flip',
    title: '🔀 جاوب أو اقلب',
    tone: 'border-q-purple/35 bg-q-purple/10 text-q-purple',
    lines: [
      '1 = جاوب: صح تاخذ النقاط.',
      '2 = اقلب على الستريمر: جوابه صح ينقص منه، غلط يزيد له.',
      'لو الستريمر قلب عليك: جوابك صح ينقص منك، غلط يزيد لك.',
    ],
  },
  {
    variant: 'triple',
    title: '↩️ جاوب أو بادل أو اعكس',
    tone: 'border-q-gold/35 bg-q-gold/10 text-q-gold',
    lines: [
      '1 = جاوب: صح تاخذ النقاط.',
      '2 = بادل: تاخذ جواب الستريمر — صح دبل، غلط ينقص منك.',
      '3 = اعكس: جواب الستريمر صح ينقص منك، غلط يزيد لك.',
      'لو الستريمر اختارك وأنت اخترته (2 أو 3): الاثنين صفر 🤝',
    ],
  },
  {
    variant: 'hide',
    title: '📦 خبّي أو اكشف',
    tone: 'border-q-green/35 bg-q-green/10 text-q-green',
    lines: [
      'الستريمر يخبّي المفتاح 🔑 والصناديق تنخلط — تابعه بعيونك.',
      'اكتب رقم الصندوق (1-10): لقيته تاخذ النقاط، وأول واحد دبل.',
      'ما أحد لقاه؟ الستريمر ياخذ النقاط، ويسرق نقاط لاعب 💸',
    ],
  },
];

export const COMMON_RULES: string[] = [
  '🔥 3 أجوبة صح ورا بعض = الثالث دبل.',
  '🎭 «مين فينا؟»: اكتب رقم الشخص — كل ما أسرع نقاطك أكثر.',
];

/** The rules; with `variant` (a game running) only that game's section, otherwise both. */
export function QuizHowTo({ forStreamer = false, variant, className }: { forStreamer?: boolean; variant?: StreamVariant; className?: string }) {
  const modes = variant ? MODE_RULES.filter((m) => m.variant === variant) : MODE_RULES;
  return (
    <div className={cn('text-start', className)}>
      {forStreamer && (
        <div className="mb-3 rounded-xl border border-q-line bg-q-panel p-3 text-xs leading-relaxed text-white/80">
          <b className="text-q-cyan">للستريمر:</b> اضغط «ابدأ البث»، اختر الطور، وافتح رابط <b>شاشة البث</b> في البث. هذي
          الصفحة لك أنت بس — لا تبثها لأنك تجاوب فيها.
        </div>
      )}
      <ol className="space-y-2">
        {VIEWER_STEPS.map((s, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-lg leading-6">{s.icon}</span>
            <div>
              <div className="text-sm font-black">{s.title}</div>
              <div className="text-xs leading-relaxed text-white/70">{s.text}</div>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-3 space-y-2.5 border-t border-q-line pt-3">
        {modes.map((m) => (
          <div key={m.variant} className={cn('rounded-xl border p-3', m.tone)}>
            <div className="mb-1.5 text-sm font-black">{m.title}</div>
            <ul className="list-disc space-y-1 ps-5 text-xs leading-relaxed text-white/80">
              {m.lines.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        ))}
        <div className="rounded-xl border border-q-orange/35 bg-q-orange/10 p-3">
          <div className="mb-1.5 text-sm font-black text-q-orange">⭐ في كل الأطوار</div>
          <ul className="list-disc space-y-1 ps-5 text-xs leading-relaxed text-white/80">
            {COMMON_RULES.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/** Small «📖 طريقة اللعب» button that opens the rules in a modal, like the main game's home screen. */
export function QuizHowToButton({ forStreamer = false, variant, className }: { forStreamer?: boolean; variant?: StreamVariant; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn('rounded-full border-[1.5px] border-white/20 px-4 py-1 text-[13px] text-white/60 transition-colors hover:border-q-purple hover:text-q-purple', className)}
      >
        📖 طريقة اللعب
      </button>
      <Modal open={open} onClose={() => setOpen(false)}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[17px] font-black text-q-purple">📖 طريقة اللعب</h2>
          <button type="button" onClick={() => setOpen(false)} className="text-xl text-white/50" aria-label="إغلاق">
            ✕
          </button>
        </div>
        <div className="max-h-[70dvh] overflow-auto">
          <QuizHowTo forStreamer={forStreamer} variant={variant} />
        </div>
      </Modal>
    </>
  );
}
