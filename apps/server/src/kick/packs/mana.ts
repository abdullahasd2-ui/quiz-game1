import type { QuestionPack } from '@quiz/shared';

const img = (id: string) => `/team/mana/${id}.webp`;

/**
 * Team Mana: eight streamers, questions about themselves. «who» questions answer with a member;
 * fact questions list the right option first (shuffled when dealt), the other three written to be close.
 */
export const MANA: QuestionPack = {
  code: 'MANA-T3P2',
  name: 'Team Mana',
  logo: img('logo'),
  members: [
    { id: 'max', name: 'ماكس', image: img('max') },
    { id: 'fahad', name: 'فهد', image: img('fahad') },
    { id: 'regex', name: 'ريجكس', image: img('regex') },
    { id: 'holz', name: 'هولز', image: img('holz') },
    { id: 'nfr', name: 'نفر', image: img('nfr') },
    { id: 'dahmani', name: 'دحمني', image: img('dahmani') },
    { id: 'kwerm', name: 'كويرم', image: img('kwerm') },
    { id: 'muath', name: 'معاذ', image: img('muath') },
  ],
  questions: [
    // ماكس
    { kind: 'fact', about: 'max', text: 'متى ماكس جاب البارتنر؟', options: ['1 مارس 2026', '1 فبراير 2026', '15 مارس 2026', '1 أبريل 2026'] },
    { kind: 'fact', about: 'max', text: 'متى يوم ميلاد ماكس؟', options: ['12 يوليو', '21 يوليو', '12 يونيو', '2 يوليو'] },
    { kind: 'fact', about: 'max', text: 'متى بدأ ماكس بثوث في الكيك؟', options: ['22 سبتمبر 2024', '22 أغسطس 2024', '12 سبتمبر 2024', '22 سبتمبر 2023'] },
    { kind: 'who', text: 'مين فينا يلقّب بـ«الجد صلبوخ»؟', answer: 'max' },
    { kind: 'who', text: 'مين فينا مدمن قراند؟', answer: 'max' },
    // فهد
    { kind: 'fact', about: 'fahad', text: 'متى أول فلوق في قناة فهد؟', options: ['2024', '2023', '2022', '2025'] },
    { kind: 'fact', about: 'fahad', text: 'كم كان وزن فهد قبل ينحف؟', options: ['160', '150', '170', '140'] },
    { kind: 'fact', about: 'fahad', text: 'وش أول سيارة امتلكها فهد؟', options: ['كورولا', 'كامري', 'أكسنت', 'سوناتا'] },
    { kind: 'who', text: 'مين فينا آخر أهدافه إنه يبث 24 ساعة؟', answer: 'fahad' },
    { kind: 'who', text: 'مين فينا أكثر واحد يسوي ريد للناس الجدد ومقولته دايم «نبيهم ينبسطون»؟', answer: 'fahad' },
    // ريجكس
    { kind: 'fact', about: 'regex', text: 'متى أول ألفية لريجكس في تاريخ الستريم؟', options: ['2023/8/1', '2023/7/1', '2023/8/11', '2023/9/1'] },
    { kind: 'fact', about: 'regex', text: 'كم كان عدد متابعين ريجكس أول ما أخذ البارتنر؟', options: ['777', '700', '770', '787'] },
    { kind: 'fact', about: 'regex', text: 'متى جاب ريجكس بارتنر الكيك؟', options: ['2025/4/13', '2025/3/13', '2025/4/3', '2025/4/23'] },
    { kind: 'fact', about: 'regex', text: 'متى بدأ «الريال الذهبي» عند ريجكس؟', options: ['2025/11/5', '2025/10/5', '2025/11/15', '2025/12/5'] },
    { kind: 'fact', about: 'regex', text: 'متى انتقل ريجكس للكيك؟', options: ['2025/1/25', '2025/2/25', '2025/1/15', '2024/12/25'] },
    // هولز
    { kind: 'fact', about: 'holz', text: 'متى كانت احتفالية البارتنر لهولز؟', options: ['24/08/2023', '14/08/2023', '24/07/2023', '24/09/2023'] },
    { kind: 'who', text: 'مين فينا أكثر واحد يقول «أبغى أختم» وفي النهاية يسحب؟', answer: 'holz' },
    { kind: 'who', text: 'مين فينا ميلاده 27/2/2005؟', answer: 'holz' },
    { kind: 'who', text: 'مين فينا كان يسحب على المدرسة ويلعب؟', answer: 'holz' },
    { kind: 'who', text: 'مين فينا يقول «دقيقة» ويختفي ساعة؟', answer: 'holz' },
    // نفر
    {
      kind: 'fact',
      about: 'nfr',
      text: 'وش سبب تسمية NFR؟',
      options: [
        'من أيام كود 6 و7: كانوا أصحاب مسمّين نفسهم نفر مجنون ونفر صاحي ونفر مهبول',
        'من أيام فيفا: اسم أول فريق لعب فيه مع أصحابه',
        'من أيام ماينكرافت: اسم السيرفر اللي كان يلعب فيه',
        'من أيام فورتنايت: اسم الكلان اللي أسسه مع أخوانه',
      ],
    },
    { kind: 'fact', about: 'nfr', text: 'متى أول بث فيس كام لـ NFR (الشهر والسنة)؟', options: ['2026/9', '2026/8', '2026/10', '2025/9'] },
    { kind: 'fact', about: 'nfr', text: 'وش كان اختيار العائلة لاسم NFR قبل «علي»؟', options: ['رامي', 'سامي', 'هاني', 'فادي'] },
    { kind: 'fact', about: 'nfr', text: 'أول بث لـ NFR كان على أي جهاز؟', options: ['سوني 4', 'سوني 3', 'سوني 5', 'إكس بوكس ون'] },
    { kind: 'fact', about: 'nfr', text: 'وش كانت يوزرات NFR قبل التوثيق في تويتش؟', options: ['NFRMGNON', 'NFRSAHI', 'MGNONNFR', 'NFRMAJNON'] },
    // دحمني
    { kind: 'fact', about: 'dahmani', text: 'وش أفضل أنمي عند دحمني؟', options: ['قاتل الشياطين', 'هجوم العمالقة', 'جوجوتسو كايسن', 'ون بيس'] },
    { kind: 'fact', about: 'dahmani', text: 'مين الشخصية المفضلة لدحمني في الأنمي؟', options: ['تانجيرو', 'زينيتسو', 'إينوسكي', 'رينغوكو'] },
    { kind: 'fact', about: 'dahmani', text: 'متى حصل دحمني على البارتنر؟', options: ['22/11/2025', '12/11/2025', '22/10/2025', '22/12/2025'] },
    { kind: 'fact', about: 'dahmani', text: 'وش رياضة دحمني المفضلة؟', options: ['كرة القدم', 'كرة السلة', 'البادل', 'كرة الطائرة'] },
    { kind: 'fact', about: 'dahmani', text: 'وش أفضل لعبة عند دحمني؟', options: ['كود', 'فورتنايت', 'فيفا', 'أبكس'] },
    // كويرم
    { kind: 'who', text: 'مين فينا أكثر واحد يغيّر ترتيب السيت أب؟', answer: 'kwerm' },
    { kind: 'who', text: 'مين فينا يحب يترك أثر وذكرى من متابعينه؟', answer: 'kwerm' },
    { kind: 'who', text: 'مين فينا صاحب مقولة «هذاك أول»؟', answer: 'kwerm' },
    { kind: 'who', text: 'مين فينا البثاث اللي يقفل بثه لأن جاه الإلهام لشي فجأة؟', answer: 'kwerm' },
    { kind: 'who', text: 'مين فينا كانت لعبته المفضلة في الصغر «قصدير» (دشعاع)؟', answer: 'kwerm' },
    // معاذ
    { kind: 'fact', about: 'muath', text: 'متى أخذ معاذ البارتنر في الكيك؟', options: ['2026/2/15', '2026/1/15', '2026/2/5', '2026/3/15'] },
    { kind: 'fact', about: 'muath', text: 'متى أول ألفية لمعاذ في الكيك؟', options: ['2026/3/10', '2026/2/10', '2026/3/20', '2026/4/10'] },
    { kind: 'fact', about: 'muath', text: 'متى انولد معاذ؟', options: ['1994/9/28', '1994/8/28', '1995/9/28', '1994/9/18'] },
    { kind: 'fact', about: 'muath', text: 'وين ومتى كانت بداية معاذ في البثوث؟', options: ['تويتش 2023/4/30', 'كيك 2023/4/30', 'تويتش 2022/4/30', 'يوتيوب 2023/4/30'] },
    { kind: 'fact', about: 'muath', text: 'وش تخصص معاذ في الجامعة؟', options: ['إعلام', 'تسويق', 'علاقات عامة', 'إدارة أعمال'] },
  ],
};
