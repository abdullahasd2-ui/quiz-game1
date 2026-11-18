# الفيديو الإعلاني للعبة الأساسية (90 ثانية)

فيديو تعريفي للعبة الأساسية (مو نسخة Kick)، 1920×1080، 30 إطار/ث، H.264، 90 ثانية بالضبط.
كل اللقطات من الموقع الحقيقي: الصفحة الرئيسية على لابتوب، وجوالين يلعبون غرفة حقيقية (الصقور ضد النمور) لين النتيجة النهائية.

1. شغّل السيرفر محليًا على 3999 مع قاعدة بيانات فيها فئات جغرافيا وكرة قدم وتاريخ وأعلام دول (أول سؤال جغرافيا بـ200: «ما هي عاصمة الإمارات؟»).
2. في هذا المجلد: `npm i @fontsource/lalezar @fontsource/tajawal`، وجهّز `fonts.css` و`assets/*-t.png` (نفس `scripts/stream-guide/promo/prepare.py`).
3. `node capture.cjs` — يلعب الغرفة كاملة ويصوّر (`shots/`).
4. `node -e "…"` أو سطر بايثون يكتب `data.js` = `window.SHOTS=<shots/shots.json>`.
5. `node preview.cjs 3 40 70` — `timeline.json` ولقطات مراجعة.
6. `python3 audio.py` — موسيقى ومؤثرات مولّدة بالكود على توقيت المشاهد (`mix.wav`).
7. `node render.cjs` ثم:
   `ffmpeg -f concat -i render/list.txt -i mix.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -t 90 -movflags +faststart promo.mp4`
