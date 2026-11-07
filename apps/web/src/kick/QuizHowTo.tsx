import { cn } from '@/lib/utils';

/** The viewers' rules, as typed in the chat. Shared by the streamer's setup page and the broadcast screen. */
export const VIEWER_STEPS: { icon: string; title: string; text: string }[] = [
  { icon: '👋', title: 'ادخل اللعبة', text: 'اكتب «دخول» في الشات — بدونها ما تلعب.' },
  { icon: '🎙️', title: 'الستريمر أول', text: 'يشوف السؤال ويجاوب أو يبادل مع واحد من المشاركين، واختياره مخفي.' },
  { icon: '1️⃣', title: 'دورك: جاوب أو بادل', text: 'يظهر السؤال بدون خيارات: اكتب 1 = جاوب، أو 2 = بادل مع الستريمر.' },
  { icon: '✍️', title: 'الجواب', text: 'إذا اخترت جاوب تظهر الخيارات: اكتب رقمها من 1 إلى 4 (أو «جاوب» + الجواب). أول جواب هو اللي يُحسب.' },
  { icon: '🏆', title: 'النتيجة', text: 'يظهر الجواب الصحيح (والصورة بدون تغبيش) وأفضل 10 وكيف أخذ كل واحد السؤال.' },
];

export const SCORING: string[] = [
  'جاوب صح = نقاط السؤال، وجاوب غلط = ما تاخذ شي.',
  'بادل مع الستريمر: إذا جوابه صح تاخذ ضعف النقاط، وإذا غلط تنقص منك نقاط السؤال.',
  'إذا الستريمر بادل معك، جوابك يُحسب له هو (ضعف أو ناقص)، وأنت ما تاخذ عليه نقاط.',
  'كل لاعب نقاطه لحاله، وأقل رصيد ممكن سالب 1000.',
];

export function QuizHowTo({ forStreamer = false, className }: { forStreamer?: boolean; className?: string }) {
  return (
    <div className={cn('q-card text-start', className)}>
      <div className="mb-3 text-center text-lg font-black text-q-gold">📖 طريقة اللعب</div>
      {forStreamer && (
        <div className="mb-3 rounded-xl border border-q-line bg-q-panel p-3 text-xs leading-relaxed text-white/80">
          <b className="text-q-cyan">لك أنت (الستريمر):</b> اربط حسابك، اختر وقت الإجابة والفئات، وابدأ. انسخ رابط <b>شاشة البث</b> وافتحه في
          الجهاز أو النافذة اللي تبثها — هذي الصفحة (التحكم) لا تبثها لأنك تجاوب فيها. كل جولة: اختر خانة من اللوحة، جاوب أو بادل، وبعدها
          الشات يلعب، ثم اضغط «اللوحة» للسؤال التالي.
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
      <div className="mt-3 border-t border-q-line pt-3">
        <div className="mb-1 text-center text-sm font-black text-q-cyan">النقاط</div>
        <ul className="list-disc space-y-1 ps-5 text-xs leading-relaxed text-white/70">
          {SCORING.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
