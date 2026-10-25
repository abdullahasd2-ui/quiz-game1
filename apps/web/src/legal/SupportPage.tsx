import { Link } from 'react-router';
import { SUPPORT_EMAIL } from './contact';
import { LegalLayout, Section } from './LegalLayout';

export function SupportPage() {
  return (
    <LegalLayout title="الدعم والمساعدة">
      <Section title="تواصل معنا">
        <p>
          عندك مشكلة أو اقتراح أو سؤال خطأ في سؤال معيّن؟ راسلنا على{' '}
          <a className="text-q-cyan underline" href={`mailto:${SUPPORT_EMAIL}`} dir="ltr">
            {SUPPORT_EMAIL}
          </a>{' '}
          ونرد عليك بأقرب وقت. اكتب نوع جهازك وكود الغرفة (إن وُجد) ووش اللي صار.
        </p>
      </Section>

      <Section title="أسئلة شائعة">
        <dl className="space-y-3">
          <div>
            <dt className="font-bold text-white">كم لاعب نحتاج؟</dt>
            <dd>فريقان، وفي كل فريق لاعب على الأقل (كل لاعب من جهازه). وفي وضع التلفاز يعرض جهاز ثالث الأسئلة.</dd>
          </div>
          <div>
            <dt className="font-bold text-white">كيف أدعو أصدقائي؟</dt>
            <dd>أنشئ غرفة وشارك الكود أو رابط الدعوة معهم. اللي معه الكود يكتبه في «الانضمام لغرفة»، واللي معه الرابط يفتحه ويدخل مباشرة.</dd>
          </div>
          <div>
            <dt className="font-bold text-white">انقطع النت أثناء اللعب</dt>
            <dd>افتح اللعبة مرة ثانية من نفس الجهاز، ترجع لنفس الغرفة والفريق تلقائيًا (الغرفة تبقى 30 دقيقة بدون نشاط).</dd>
          </div>
          <div>
            <dt className="font-bold text-white">أقدر ألعب من المتصفح؟</dt>
            <dd>
              إي، على{' '}
              <a className="text-q-cyan underline" href="/" dir="ltr">
                jawabbadel.com
              </a>
              ، وتقدر تلعب مع أصحابك اللي على التطبيق.
            </dd>
          </div>
        </dl>
      </Section>

      <Section title="الخصوصية">
        <p>
          تفاصيل اللي نحفظه واللي ما نحفظه في{' '}
          <Link className="text-q-cyan underline" to="/privacy">
            سياسة الخصوصية
          </Link>
          .
        </p>
      </Section>
    </LegalLayout>
  );
}
