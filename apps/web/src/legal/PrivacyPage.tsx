import { SUPPORT_EMAIL } from './contact';
import { LegalLayout, Section } from './LegalLayout';

/** What the game stores, as of the code in apps/server/src/game (rooms in memory, usage.ts for the stats tables). */
export function PrivacyPage() {
  return (
    <LegalLayout title="سياسة الخصوصية">
      <p className="text-[13px] text-white/50">آخر تحديث: 25 أكتوبر 2026</p>

      <Section title="باختصار">
        <p>
          «جاوب أو بادل» لعبة أسئلة جماعية. ما فيها حسابات ولا تسجيل دخول، ولا نطلب بريدك أو رقمك أو موقعك أو صورك أو جهات اتصالك. ما فيها إعلانات
          ولا أدوات تتبّع، ولا نبيع بياناتك ولا نشاركها لأغراض تسويقية.
        </p>
      </Section>

      <Section title="اللي يُحفظ أثناء اللعب">
        <ul className="list-disc space-y-1.5 ps-5">
          <li>
            <b className="text-white">أسماء اللاعبين والفرق</b> اللي تكتبها بنفسك. تظهر لباقي اللاعبين في نفس الغرفة، وتبقى في ذاكرة السيرفر فقط
            طول عمر الغرفة، وتنحذف لما تُغلق الغرفة أو تمر 30 دقيقة بدون نشاط. ما تُحفظ في قاعدة البيانات.
          </li>
          <li>
            <b className="text-white">كود الغرفة وحالتها</b> (النقاط والأسئلة المعروضة والإجابات) لنفس المدة.
          </li>
        </ul>
      </Section>

      <Section title="اللي يُحفظ على جهازك">
        <p>
          يحفظ التطبيق على جهازك معرّفًا عشوائيًا (مو مرتبط باسمك ولا بحساب) ورمز الغرفة الحالية، عشان لو انقطع النت أو أعدت فتح التطبيق ترجع لنفس
          مقعدك في الفريق. تقدر تمسحه بحذف التطبيق أو مسح بيانات المتصفح.
        </p>
      </Section>

      <Section title="إحصائيات الاستخدام">
        <p>نخزّن في قاعدة بياناتنا إحصائيات مجهولة الهوية لنعرف كم لعبة تُلعب وأي الفئات أحب للاعبين:</p>
        <ul className="list-disc space-y-1.5 ps-5">
          <li>المعرّف العشوائي أعلاه مع نوع المنصة (ويب أو iOS أو Android) وتاريخ اليوم وعدد مرات الفتح.</li>
          <li>بيانات كل لعبة: نوعها والفئات المختارة وعدد الجولات والنتيجة. بدون أسماء لاعبين.</li>
        </ul>
        <p>هذي البيانات ما تُربط بهويتك، وما نستخدمها لتتبعك عبر تطبيقات أو مواقع ثانية.</p>
      </Section>

      <Section title="سجلات السيرفر">
        <p>
          مثل أي موقع، يسجّل السيرفر طلبات الاتصال (التاريخ والمسار وعنوان IP) لتشغيل الخدمة وحمايتها من الإساءة. قد تمر الاتصالات عبر خدمة
          Cloudflare المسؤولة عن الحماية والتسريع. نسخة الويب تحمّل خط Tajawal من Google Fonts، أما التطبيق فالخط داخله.
        </p>
      </Section>

      <Section title="تحديث التطبيق">
        <p>
          عند فتح تطبيق الجوال يسأل سيرفرنا (jawabbadel.com) إذا فيه تحديث لشاشات اللعبة، ويرسل رقم نسخة التطبيق ومعرّف تحديث عشوائي. ما يُرسل أي
          شي عن اسمك أو لعبتك، ولا يُرسل لأي جهة خارجية.
        </p>
      </Section>

      <Section title="الأطفال">
        <p>اللعبة مناسبة لكل الأعمار وما نجمع معلومات شخصية عن أي أحد، سواء طفل أو بالغ. اللاعب يكتب الاسم اللي يبغاه، والأفضل ما يكتب اسمه الحقيقي كاملًا.</p>
      </Section>

      <Section title="حقوقك">
        <p>
          ما عندنا بيانات تعرّف بك شخصيًا لنعدّلها أو نحذفها، لكن لو عندك سؤال أو طلب بخصوص الخصوصية راسلنا على{' '}
          <a className="text-q-cyan underline" href={`mailto:${SUPPORT_EMAIL}`} dir="ltr">
            {SUPPORT_EMAIL}
          </a>
          . إذا غيّرنا هذي السياسة بنحدّث التاريخ أعلاه.
        </p>
      </Section>

      <Section title="Summary (English)">
        <div dir="ltr" className="space-y-2 text-left">
          <p>
            Jawab aw Badel is a team trivia game. There are no accounts, ads or third-party trackers, and we do not sell or share personal data. Names
            you type are shown to the other players in your room and live only in server memory until the room closes or sits idle for 30 minutes.
          </p>
          <p>
            We store a random, anonymous per-install identifier on your device (to keep your seat after a reconnect) and, in our database, anonymous
            usage statistics: that identifier with the platform and date, and per-game figures (mode, categories, rounds, score) without player names.
            Our server keeps standard request logs (including IP addresses) to run and protect the service. The mobile app checks our own server for
            updates to the game screens. Questions:{' '}
            <a className="text-q-cyan underline" href={`mailto:${SUPPORT_EMAIL}`}>
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
        </div>
      </Section>
    </LegalLayout>
  );
}
