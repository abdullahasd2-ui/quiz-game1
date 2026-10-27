# فيديوهات «جاوب أو بادل»

| الملف | لماذا | يصلح لـ |
|---|---|---|
| `jawabbadel-app-preview-real-886x1920.mp4` | تسجيل شاشة حقيقي للعبة + نصوص وتلاشي فقط | **معاينة App Store** (تُرفع لاحقًا) |
| `jawabbadel-promo-1080x1920.mp4` | فيديو ترويجي بحركة وتأثيرات من لقطات التطبيق | النشر والتسويق، ومرفق لفريق مراجعة أبل |
| `jawabbadel-app-preview-886x1920.mp4` | نسخة بدقة المعاينة من الفيديو المحرّك | **لا ترفعها لأبل**: لقطات ثابتة محرّكة، مخاطرة رفض متوسطة (بند 2.3.4) |

**ملفات mp4 كلها خارج git** (`.gitignore`): كبيرة ويمكن إعادة توليدها. على جهاز جديد تحتاج تسجّل جولة لعب بـ `xcrun simctl io <جهاز> recordVideo` وتمررها لـ `make_preview.py`، أو ترجع للملفات المحفوظة على جهاز أحمد.

المجلدات:
- `real-preview/`: مصدر المعاينة الحقيقية. `source-recording.mp4` هو تسجيل المحاكي (135 ثانية)، و`make_preview.py` يقصّ المقاطع ويركّب النصوص والصوت،
  و`make_audio.py` يركّب الموسيقى. الأمر من جذر المستودع (يحتاج ffmpeg وGoogle Chrome وPillow وخط Tajawal من `node_modules`):

  ```bash
  python3 -I apps/mobile/store/video/real-preview/make_preview.py apps/mobile/store/video/real-preview/source-recording.mp4 /مجلد/مؤقت out.mp4
  ```

  أوقات المقاطع ونصوصها في أعلى `make_preview.py` (قائمة `SEGS`).
- `src/`: مصدر الفيديو الترويجي المحرّك (HTML وChrome وffmpeg)، وشرح إعادة توليده في `src/README.md`.
