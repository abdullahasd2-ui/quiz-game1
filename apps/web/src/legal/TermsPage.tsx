import { SUPPORT_EMAIL } from './contact';
import { LegalLayout, Section } from './LegalLayout';

/** Terms of use (linked from the home page and given to TikTok/Kick for the streamer sign-in). */
export function TermsPage() {
  return (
    <LegalLayout title="شروط الاستخدام">
      <p className="text-[13px] text-white/50">آخر تحديث: 18 نوفمبر 2026</p>

      <Section title="عن اللعبة">
        <p>
          «جاوب أو بادل» (jawabbadel.com وتطبيق iPhone) لعبة أسئلة جماعية مجانية: فريقين على أجهزتهم أو على التلفاز، ووضع للبث يلعب فيه الستريمر مع
          متابعينه من شات البث. باستخدامك للعبة أنت توافق على هذي الشروط.
        </p>
      </Section>

      <Section title="الاستخدام المقبول">
        <ul className="list-disc space-y-1.5 ps-5">
          <li>اكتب أسماء لاعبين وفرق لائقة، ولا تستخدم أسماء أو كلام فيه إساءة أو تحرّش أو عنصرية أو انتحال شخصية أحد.</li>
          <li>لا تحاول تعطّل الخدمة أو تخترقها أو ترسل طلبات آلية مزعجة للسيرفر.</li>
          <li>الستريمر مسؤول عن بثه وعن التزامه بشروط المنصة اللي يبث عليها (مثل Kick أو TikTok).</li>
        </ul>
      </Section>

      <Section title="ربط حساب البث">
        <p>
          في وضع البث تقدر تسجّل دخول بحسابك في Kick أو TikTok. نستخدم هذا بس عشان نعرف حسابك (الاسم الظاهر والصورة واسم المستخدم) ونربط اللعبة بقناتك،
          وما ننشر شي باسمك ولا نوصل لرسائلك الخاصة. تقدر تلغي الربط في أي وقت من «تسجيل خروج» في صفحة البث أو من إعدادات حسابك في المنصة.
        </p>
      </Section>

      <Section title="الأسئلة والمحتوى">
        <p>
          نحاول تكون الأسئلة والأجوبة صحيحة، لكن ممكن يصير خطأ. إذا لقيت سؤال غلط راسلنا ونصلحه. شعار اللعبة وتصميمها وأسئلتها ملك لـ«جاوب أو بادل»، وأسماء
          المنصات وشعاراتها (مثل Kick وTikTok) لأصحابها.
        </p>
      </Section>

      <Section title="الخدمة كما هي">
        <p>
          نقدّم اللعبة «كما هي» وبدون ضمان إنها تشتغل دايم بدون انقطاع. ممكن نغيّر أو نوقف ميزة، أو نمنع من يسيء الاستخدام. وما نتحمل أي ضرر غير مباشر من
          استخدام اللعبة، في حدود ما يسمح به النظام.
        </p>
      </Section>

      <Section title="الخصوصية والتواصل">
        <p>
          تفاصيل البيانات في{' '}
          <a className="text-q-cyan underline" href="/privacy">
            سياسة الخصوصية
          </a>
          . إذا غيّرنا الشروط بنحدّث التاريخ أعلاه. للتواصل:{' '}
          <a className="text-q-cyan underline" href={`mailto:${SUPPORT_EMAIL}`} dir="ltr">
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </Section>

      <Section title="Terms of Use (English)">
        <div dir="ltr" className="space-y-2 text-left">
          <p>
            Jawab aw Badel (jawabbadel.com and the iPhone app) is a free group trivia game, including a streaming mode where a streamer plays with their
            LIVE chat. By using it you agree to these terms.
          </p>
          <p>
            Use respectful names, do not attack or abuse the service, and follow the rules of the platform you stream on. Streamers may sign in with
            Kick or TikTok; we only use this to identify the account (display name, avatar, username) and connect the game to that channel. We never
            post on your behalf or read private messages, and you can disconnect at any time. The game is provided as is, without warranties; we may
            change or stop features. Questions: <a className="text-q-cyan underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
          </p>
        </div>
      </Section>
    </LegalLayout>
  );
}
