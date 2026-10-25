# بيانات App Store Connect — جاوب أو بادل

كل شي هنا جاهز للنسخ واللصق في App Store Connect. اللقطات في `screenshots/`: آيفون بمقاس 1320×2868 (6.9") وآيباد بمقاس 2064×2752 (13").

## الصفحة الرئيسية للتطبيق

| الحقل | القيمة |
|---|---|
| الاسم (30 حرفًا) | جاوب أو بادل |
| العنوان الفرعي (30) | لعبة أسئلة جماعية بين فريقين |
| الفئة | Games ← Trivia، وفرعية ثانية Family |
| لغة التطبيق الأساسية | Arabic |
| رابط الدعم | https://jawabbadel.com/support |
| رابط التسويق (اختياري) | https://jawabbadel.com |
| رابط سياسة الخصوصية | https://jawabbadel.com/privacy |
| حقوق النشر | 2026 Ahmad Alsamani |
| السعر | مجاني، بدون شراء داخل التطبيق |
| ما الجديد (الإصدار 1.0) | الإصدار الأول من جاوب أو بادل! |

### النص الترويجي (170)

جاوب بنفسك أو بادل جواب خصمك واسرق نقاطه! لعبة أسئلة سريعة بين فريقين، تلعبونها من جوالاتكم أو على التلفاز.

### الكلمات المفتاحية (100)

```
أسئلة,مسابقة,تحدي,ثقافة عامة,فرق,أصدقاء,عائلة,تريفيا,كويز,ألعاب جماعية,معلومات,quiz,trivia
```

### الوصف

```
جاوب أو بادل لعبة أسئلة جماعية بين فريقين. تحدّوا بعض في فئات تحبونها، وكل سؤال فيه قرار: جاوب بنفسك، أو بادل الجواب لخصمك وخلّه هو اللي يتورّط!

كيف تلعبون؟
• أنشئ غرفة وشارك الكود أو رابط الدعوة مع أصدقائك.
• كل فريق يلعب من جهازه، وأنتم من 2 إلى 20 لاعب.
• اختاروا الفئات: كرة قدم، جغرافيا، تاريخ، سيارات، أعلام دول، معالم، براندات، ومسيرة لاعب.
• كل فئة فيها أسئلة من 100 إلى 500 نقطة، والأصعب يعطي نقاط أكثر.
• القرار سرّي حتى تظهر النتيجة: جاوب = نقاط السؤال لك إذا صح. بادل = الخصم يجاوب، فإذا صح ينقص نقاطه وإذا غلط تزيد نقاطك.

أنواع اللعب
• وضع الجوال: كل فريق على جهازه.
• وضع التلفاز: جهاز ثالث يعرض الأسئلة للجميع، والفريقان يجاوبان من جوالاتهم.
• جاوب أو بادل، وجاوب أو اقلب: نظامان للنقاط بنفس الفكرة وبمتعة مختلفة.

أسئلة بالصور
اكتشف الصورة المغبّشة، واكتشف الزوم، وأعلام ومعالم وبراندات، والصورة الكاملة تظهر مع النتيجة.

لا حسابات ولا تسجيل. افتح التطبيق، أنشئ غرفة، وابدأ اللعب. لو انقطع النت ترجع لنفس الغرفة والفريق تلقائيًا.

مناسبة للسهرات والرحلات والعائلة والأصحاب. جرّبوها وشوفوا من يكسب!
```

## خصوصية التطبيق (App Privacy)

الإجابة اللي تطابق الكود فعلًا (`apps/server/src/game/usage.ts` وجداول `daily_visits` و`games`) وملف `PrivacyInfo.xcprivacy`:

- **هل تجمع بيانات؟** نعم.
- **Identifiers ← Device ID**: معرّف عشوائي لكل تثبيت مع اسم المنصة ويوم الزيارة. الغرض: **Analytics**. غير مرتبط بهوية المستخدم، وغير مستخدم للتتبع.
- **Usage Data ← Product Interaction**: نوع اللعبة والفئات وعدد الجولات والنتيجة، بدون أسماء. الغرض: **Analytics**. غير مرتبط بالهوية، وغير مستخدم للتتبع.
- **Tracking**: لا.
- باقي الأنواع (الاسم، البريد، الموقع، الصور، جهات الاتصال، المشتريات…): لا تُجمع.

قرارات تقديرية تبقى لك، وكلها في صالح الإفصاح:
- أسماء اللاعبين والفرق تبقى في ذاكرة السيرفر طول عمر الغرفة (تنحذف بعد 30 دقيقة بدون نشاط) ولا تدخل قاعدة البيانات، فما أعدّها «مجموعة». إذا تبغى الحذر الزائد أضف **Contact Info ← Name** بغرض App Functionality وغير مرتبط بالهوية.
- سجلات السيرفر تحتوي عنوان IP لتشغيل الخدمة وحمايتها. صفحة الخصوصية تذكرها، وما أدرجتها في إجابة App Privacy لأنها سجلات تشغيل عادية. إذا تبغى الحذر الزائد أضف **Diagnostics** أو **Other Diagnostic Data** بغرض App Functionality.

## تصنيف العمر

كل الأسئلة «لا / None»: عنف، محتوى جنسي، قمار، مخدرات، رعب، لغة نابية. التطبيق ما فيه دردشة ولا محتوى مستخدمين ولا متصفح مفتوح ولا مشتريات. المتوقع **4+**.

## التصدير (Export Compliance)

`ITSAppUsesNonExemptEncryption = false` موجود في `Info.plist`، فما يطلع سؤال تشفير مع كل بناء. التطبيق يستخدم HTTPS القياسي فقط.

## الوصول لحساب المراجعة

لا يوجد تسجيل دخول. اترك **Sign-in required** مطفأ. بيانات الاتصال بالمراجِع (الاسم والجوال والبريد) من عندك، وتنكتب مرة واحدة.

## ملاحظات للمراجِع (App Review Notes)

انسخها كما هي (بالإنجليزية، لأن المراجعين يقرؤونها):

```
No account or login is needed.

The game is multiplayer by design: two teams play against each other, each from its own device, so a review needs two players. The quickest way to test it alone:

1. Open the app on the review device and tap "إنشاء غرفة" (Create room). A 6-character room code appears.
2. On a second device, or in Safari on the same device, open https://jawabbadel.com , tap "الفريق الثاني" (Second team) under "الانضمام لغرفة" (Join a room), type any name and the room code, and tap "انضمام" (Join).
3. In the app, as host, pick at least 3 categories and tap "ابدأ اللعبة!" (Start). Questions then alternate between the two teams: each team secretly chooses to answer ("جاوب") or to pass the question to the opponent ("بادل").

The app asks no permissions. Player names are only shown to the other players in the same room and are kept in server memory while the room is open.

The app downloads updated game screens (HTML/CSS/JavaScript run inside the app's WebView) from our own server, https://jawabbadel.com , which is the interpreted-code update that Apple permits as long as it does not change the app's primary purpose; the updates only change the game's screens, never its purpose.

Privacy policy: https://jawabbadel.com/privacy   Support: https://jawabbadel.com/support
```

اقتراح يرفع احتمال القبول: صوّر فيديو قصير (30–60 ثانية) لجولة كاملة بين جهازين وأرفقه في خانة Attachment، لأن أكثر رفض لألعاب الغرف هو «ما قدرنا نجرّب اللعب».

## قبل الإرسال

1. **سياسة الخصوصية والدعم لازم تكون شغّالة على الإنترنت** قبل الإرسال: افتح `https://jawabbadel.com/privacy` و`/support`. هذي تنزل مع نشر `main`.
2. بريد الدعم `support@jawabbadel.com` (ثابت واحد في `apps/web/src/legal/contact.ts`): تأكد أن الصندوق يستقبل رسائل فعلًا، مثل Cloudflare Email Routing.
3. اختر **البناء رقم 3** (أو أحدث). البناء 2 ما فيه ملف الخصوصية ولا رابط الخصوصية داخل اللعبة.
4. ارفع اللقطات: iPhone 6.9" (4 لقطات) وiPad 13" (7 لقطات). أبل تصغّرها تلقائيًا لباقي المقاسات.
5. أكمل: App Privacy، تصنيف العمر، الفئة، السعر والتوفر، ثم **Add for Review** و**Submit**.

## تنبيه حقوق المحتوى

سؤال Content Rights في App Store Connect: لعبتك فيها صور (معالم، براندات، أعلام، سيارات). تأكد أنك تملك حق استخدام الصور وشعارات الشركات، لأن الرفض بسبب الملكية الفكرية (بند 5.2) يصير غالبًا مع الشعارات. إذا فيه صور مأخوذة من الإنترنت بدون ترخيص، استبدلها أو احذف الأسئلة قبل الإرسال.
