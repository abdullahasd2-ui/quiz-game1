import type { StreamVariant } from '@quiz/shared';
import { useState } from 'react';
import { Modal } from '@/game/ui';
import { cn } from '@/lib/utils';

/** The viewers' rules, as typed in the chat. Shared by the streamer's setup page and the broadcast screen. */
type Step = { icon: string; title: string; text: string };
const JOIN: Step = { icon: '👋', title: 'ادخل', text: 'اكتب «دخول» في الشات عشان تشارك. وإذا تبي تطلع اكتب «خروج» (تنمسح نقاطك).' };
const SCORE: Step = { icon: '📊', title: 'نقاطي', text: 'اكتب «نقاطي» في الشات وتطلع نقاطك ومركزك على الشاشة.' };

/** The viewers' steps, as typed in the chat — they differ by game. Without a game, the «جاوب أو …» steps. */
export function viewerSteps(variant?: StreamVariant): Step[] {
  if (variant === 'list')
    return [
      JOIN,
      { icon: '⏱️', title: 'السؤال', text: 'يطلع سؤال مثل «اذكر لاعبين من الدوري الإسباني» ويبدأ الوقت على طول.' },
      { icon: '✍️', title: 'اكتب الأجوبة', text: 'اكتب في الشات أكبر عدد من الأجوبة الصح، وكل جواب صح نقطة. تقدر تكتب أكثر من جواب بينها «،».' },
      SCORE,
    ];
  if (variant === 'hide')
    return [
      JOIN,
      { icon: '🔑', title: 'تابع المفتاح', text: 'الستريمر يخبّي المفتاح في صندوق، والصناديق تنخلط قدامكم. تابعه بعيونك.' },
      { icon: '📦', title: 'خمّن', text: 'اكتب رقم الصندوق اللي فيه المفتاح من 1 إلى 10. أول رقم تكتبه هو اللي ينحسب.' },
      SCORE,
    ];
  const choose =
    variant === 'flip'
      ? 'اكتب 1 عشان تجاوب بنفسك، أو 2 عشان تقلب على الستريمر.'
      : variant === 'triple'
      ? 'اكتب 1 عشان تجاوب بنفسك، أو 2 عشان تبادل مع الستريمر، أو 3 عشان تعكس على الستريمر.'
      : variant === 'swap'
      ? 'اكتب 1 عشان تجاوب بنفسك، أو 2 عشان تبادل مع الستريمر.'
      : 'اكتب 1 عشان تجاوب بنفسك، أو 2 عشان تبادل أو تقلب على الستريمر (حسب الطور).';
  return [
    JOIN,
    { icon: '🎙️', title: 'الستريمر أول', text: 'الستريمر يجاوب على السؤال أو يختار واحد منكم، واختياره مخفي عنكم.' },
    { icon: '1️⃣', title: 'اختر', text: choose },
    { icon: '✍️', title: 'جاوب', text: 'إذا اخترت تجاوب بنفسك، اكتب رقم الجواب من 1 إلى 4، أو اكتب الجواب نفسه.' },
    SCORE,
  ];
}

/** Each stream game has its own scoring, shown as its own section. */
export const MODE_RULES: { variant: StreamVariant; title: string; tone: string; lines: string[] }[] = [
  {
    variant: 'swap',
    title: '🔄 جاوب أو بادل',
    tone: 'border-q-cyan/35 bg-q-cyan/10 text-q-cyan',
    lines: [
      'اكتب 1 = جاوب بنفسك: إذا جوابك صح تاخذ نقاط السؤال، وإذا جوابك غلط ما تاخذ شي.',
      'اكتب 2 = بادل مع الستريمر: تاخذ جواب الستريمر بدال جوابك. إذا جواب الستريمر صح تاخذ دبل النقاط والستريمر ما ياخذ شي، وإذا جواب الستريمر غلط تنقص من نقاطك.',
      'إذا الستريمر بادل معك: أنت تجاوب وجوابك يروح له. إذا جوابك صح ياخذ الستريمر دبل النقاط وأنت ما تاخذ شي، وإذا جوابك غلط تنقص من نقاط الستريمر.',
    ],
  },
  {
    variant: 'flip',
    title: '🔀 جاوب أو اقلب',
    tone: 'border-q-purple/35 bg-q-purple/10 text-q-purple',
    lines: [
      'اكتب 1 = جاوب بنفسك: إذا جوابك صح تاخذ نقاط السؤال، وإذا جوابك غلط ما تاخذ شي.',
      'اكتب 2 = اقلب على الستريمر: نتيجة الستريمر تنقلب. إذا جواب الستريمر صح تنقص من نقاطه، وإذا جواب الستريمر غلط تزيد نقاطه.',
      'إذا الستريمر قلب عليك: نتيجتك تنقلب. إذا جوابك صح تنقص من نقاطك، وإذا جوابك غلط تزيد نقاطك.',
    ],
  },
  {
    variant: 'triple',
    title: '↩️ جاوب أو بادل أو اعكس',
    tone: 'border-q-gold/35 bg-q-gold/10 text-q-gold',
    lines: [
      'اكتب 1 = جاوب بنفسك: إذا جوابك صح تاخذ نقاط السؤال، وإذا جوابك غلط ما تاخذ شي.',
      'اكتب 2 = بادل مع الستريمر: تاخذ جواب الستريمر بدال جوابك. إذا جواب الستريمر صح تاخذ دبل النقاط والستريمر ما ياخذ شي، وإذا جواب الستريمر غلط تنقص من نقاطك.',
      'اكتب 3 = اعكس على الستريمر: إذا جواب الستريمر صح تنقص من نقاطك، وإذا جواب الستريمر غلط تزيد نقاطك. والستريمر ياخذ نقاطه عادي.',
      'إذا الستريمر بادل معك: أنت تجاوب وجوابك يروح له. إذا جوابك صح ياخذ الستريمر دبل النقاط وأنت ما تاخذ شي، وإذا جوابك غلط تنقص من نقاط الستريمر.',
      'إذا الستريمر عكس عليك: أنت تجاوب وتاخذ نقاطك عادي. إذا جوابك صح تنقص من نقاط الستريمر، وإذا جوابك غلط تزيد نقاط الستريمر.',
      '🤝 إذا الستريمر اختارك (بادل أو عكس عليك) وأنت كتبت 2 أو 3 عليه: يعني اخترتوا بعض، والاثنين ياخذون صفر.',
      'العكس على الستريمر ما ينحسب إلا إذا جاوب الستريمر بنفسه.',
    ],
  },
  {
    variant: 'list',
    title: '⏱️ عدّها',
    tone: 'border-q-orange/35 bg-q-orange/10 text-q-orange',
    lines: [
      'يطلع سؤال مثل «اذكر لاعبين من الدوري الإسباني»، واكتب في الشات أكبر عدد من الأجوبة الصح قبل ما يخلص الوقت.',
      'كل جواب صح تاخذ عليه نقطة. نفس الجواب ما ينحسب لك مرتين، لكن لو غيرك كتبه ينحسب له بعد.',
      'تقدر تكتب أكثر من جواب في رسالة وحدة وتفصل بينها بفاصلة «،».',
      'لما يخلص الوقت: اللي جاب أكثر أجوبة ياخذ 5 نقاط زيادة، والثاني 3 نقاط زيادة، والثالث نقطتين زيادة.',
    ],
  },
  {
    variant: 'hide',
    title: '📦 خبّي أو اكشف',
    tone: 'border-q-green/35 bg-q-green/10 text-q-green',
    lines: [
      'الستريمر يخبّي المفتاح 🔑 في صندوق، وبعدين الصناديق تنخلط قدامكم. تابع الصندوق اللي فيه المفتاح بعيونك.',
      'اكتب رقم الصندوق من 1 إلى 10. إذا لقيت المفتاح تاخذ النقاط، وأول واحد يلقاه ياخذ دبل النقاط. وأول رقم تكتبه هو اللي ينحسب.',
      'إذا ما أحد لقى المفتاح: الستريمر ياخذ نقاط الجولة، ويختار لاعب ويسرق كل نقاطه 💸',
    ],
  },
];

export const COMMON_RULES: string[] = [
  '🔥 إذا جاوبت 3 أجوبة صح ورا بعض، الجواب الثالث تاخذ عليه دبل النقاط.',
];

/** The rules; with `variant` (a game running) only that game's section, otherwise both. */
/** Only for a team pack («🎭 حزمة فريق»), never in the general rules. */
const PACK_RULE = '🎭 «مين فينا؟»: تطلع صور أعضاء الفريق، واكتب رقم الشخص اللي هو الجواب. كل ما جاوبت أسرع تاخذ نقاط أكثر، لأن الصور الغلط تختفي ونقاط السؤال تنقص مع الوقت.';

export function QuizHowTo({ forStreamer = false, variant, pack = false, className }: { forStreamer?: boolean; variant?: StreamVariant; pack?: boolean; className?: string }) {
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
        {viewerSteps(variant).map((s, i) => (
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
            {(pack ? [...COMMON_RULES, PACK_RULE] : COMMON_RULES).map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/** Small «📖 طريقة اللعب» button that opens the rules in a modal, like the main game's home screen. */
export function QuizHowToButton({ forStreamer = false, variant, pack = false, className }: { forStreamer?: boolean; variant?: StreamVariant; pack?: boolean; className?: string }) {
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
          <QuizHowTo forStreamer={forStreamer} variant={variant} pack={pack} />
        </div>
      </Modal>
    </>
  );
}
