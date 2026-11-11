import type { StreamVariant } from '@quiz/shared';
import { useState } from 'react';
import { Modal } from '@/game/ui';
import { cn } from '@/lib/utils';

/** The viewers' rules, as typed in the chat. Shared by the streamer's setup page and the broadcast screen. */
export const VIEWER_STEPS: { icon: string; title: string; text: string }[] = [
  { icon: '👋', title: 'ادخل اللعبة', text: 'اكتب «دخول» في الشات — بدونها ما تلعب. وتبي تطلع؟ اكتب «خروج» (تنمسح نقاطك).' },
  { icon: '🎙️', title: 'الستريمر أول', text: 'يشوف السؤال ويجاوب، أو يبادل/يقلب على واحد من المشاركين، واختياره مخفي.' },
  { icon: '1️⃣', title: 'دورك: 1 أو 2', text: 'يظهر السؤال بدون خيارات: اكتب 1 = جاوب، أو 2 = بادل مع الستريمر (أو اقلب عليه — حسب الطور)، وفي «جاوب أو بادل أو اعكس» فيه 3 = اعكس.' },
  { icon: '✍️', title: 'الجواب', text: 'إذا اخترت جاوب تظهر الخيارات: اكتب رقمها من 1 إلى 4 (أو «جاوب» + الجواب). أول جواب هو اللي يُحسب.' },
  { icon: '📊', title: 'نقاطي', text: 'اكتب «نقاطي» بأي وقت ويطلع على الشاشة رصيدك ومركزك.' },
  { icon: '🏆', title: 'النتيجة', text: 'يظهر الجواب الصحيح (والصورة بدون تغبيش) وأفضل 10 وكيف أخذ كل واحد السؤال.' },
];

/** Each stream game has its own scoring, shown as its own section. */
export const MODE_RULES: { variant: StreamVariant; title: string; tone: string; lines: string[] }[] = [
  {
    variant: 'swap',
    title: '🔄 جاوب أو بادل',
    tone: 'border-q-cyan/35 bg-q-cyan/10 text-q-cyan',
    lines: [
      'اكتب 1 = جاوب، أو 2 = بادل مع الستريمر.',
      'جاوب صح = نقاط السؤال، وجاوب غلط = ما تاخذ شي.',
      'بادل مع الستريمر: تاخذ جوابه — إذا صح تاخذ ضعف النقاط، وإذا غلط تنقص منك نقاط السؤال.',
      'إذا الستريمر بادل معك: جوابك يُحسب له هو (ضعف أو ناقص)، وأنت ما تاخذ عليه نقاط.',
    ],
  },
  {
    variant: 'flip',
    title: '🔀 جاوب أو اقلب',
    tone: 'border-q-purple/35 bg-q-purple/10 text-q-purple',
    lines: [
      'اكتب 1 = جاوب، أو 2 = اقلب على الستريمر.',
      'جاوب صح = نقاط السؤال، وجاوب غلط = ما تاخذ شي.',
      'اقلب على الستريمر: نتيجته تنقلب مرة وحدة مهما كان عدد اللي قلبوا — جوابه صح = تنقص نقاطه، غلط = تزيد. واللي قلب ما ياخذ شي.',
      'إذا الستريمر قلب عليك: نتيجتك تنقلب — جوابك صح = تنقص، غلط = تزيد، وهو ما ياخذ شي.',
    ],
  },
  {
    variant: 'triple',
    title: '↩️ جاوب أو بادل أو اعكس',
    tone: 'border-q-gold/35 bg-q-gold/10 text-q-gold',
    lines: [
      'اكتب 1 = جاوب، أو 2 = بادل مع الستريمر، أو 3 = اعكس على الستريمر.',
      'بادل: نفس «جاوب أو بادل» — جوابه صح = لك الضعف وهو ما ياخذ شي (انزرف)، غلط = تنقص منك.',
      'اعكس: جواب الستريمر صح = تنقص منك نقاط السؤال، غلط = تزيد لك. والستريمر ياخذ نقاطه عادي.',
      'إذا الستريمر عكس عليك: أنت تجاوب وتاخذ نقاطك عادي، وهو ينعكس عليه — جوابك صح = تنقص منه، غلط = تزيد له.',
      'إذا الستريمر بادل معك: جوابك يُحسب له (ضعف أو ناقص)، وأنت تنزرف وما تاخذ شي.',
      '🤝 إذا الستريمر اختارك (بادل أو اعكس) وأنت اخترت 2 أو 3 عليه: اخترتوا بعض — الاثنين صفر.',
      'إذا الستريمر بادل أو عكس على أحد، اللي يبادلون أو يعكسون عليه ما لهم شي (لأنه ما جاوب بنفسه).',
    ],
  },
  {
    variant: 'hide',
    title: '📦 خبّي أو اكشف',
    tone: 'border-q-green/35 bg-q-green/10 text-q-green',
    lines: [
      'الستريمر يحط المفتاح 🔑 في صندوق قدّامكم، وبعدها الصناديق تنخلط — تابعوه بعيونكم!',
      'نقاط كل جولة عشوائية وتحدد سرعة الخلط: 100 عادي، 200 متوسط، 300 سريع جداً.',
      'لما يوقف الخلط: اكتب رقم المكان (1 إلى 10) اللي وقف فيه المفتاح — أول رقم تكتبه هو اللي ينحسب.',
      'لقيت المفتاح = نقاط الجولة، وأول واحد يلقاه ياخذ دبل ⚡.',
      'إذا ما لقاه أحد: الستريمر ياخذ نقاط الجولة، وبعدها يختار واحد من المشاركين وياخذ كل نقاطه 💸.',
      'ما فيه تلميح ولا مبادلة في هذا الطور.',
    ],
  },
];

export const COMMON_RULES: string[] = [
  '🔥 جاوب صح 3 مرات ورا بعض: نقاط السؤال الثالث دبل! والغلط يرجّع السلسلة من الصفر.',
  '⚡ أسرع واحد يجاوب صح يطلع اسمه على الشاشة.',
  '🎭 حزمة فريق: أسئلة عن أعضاء الفريق. في «مين فينا؟» اكتب رقم الشخص (1-8)، والصور الغلط تطلع وحدة وحدة والنقاط تنزل معها — اللي يعرف أسرع ياخذ أكثر.',
  'كل لاعب نقاطه لحاله، وأقل رصيد ممكن سالب 1000.',
];

/** The rules; with `variant` (a game running) only that game's section, otherwise both. */
export function QuizHowTo({ forStreamer = false, variant, className }: { forStreamer?: boolean; variant?: StreamVariant; className?: string }) {
  const modes = variant ? MODE_RULES.filter((m) => m.variant === variant) : MODE_RULES;
  return (
    <div className={cn('text-start', className)}>
      {forStreamer && (
        <div className="mb-3 rounded-xl border border-q-line bg-q-panel p-3 text-xs leading-relaxed text-white/80">
          <b className="text-q-cyan">لك أنت (الستريمر):</b> اربط حسابك واضغط «ابدأ البث»، وبعدها اختر الطور والفئات ووقت الإجابة. انسخ رابط{' '}
          <b>شاشة البث</b> وافتحه في الجهاز أو النافذة اللي تبثها، ومنها تختار الأسئلة من اللوحة. هذي الصفحة (التحكم) لا تبثها لأنك تجاوب
          فيها: جاوب بنفسك أو بادل/اقلب على واحد من المشاركين، وبعدها الشات يلعب.
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
