# فيديو شرح البث

الفيديو اللي يفتح من زر «🎬 شاهد الشرح» في صفحة البث (`apps/web/public/videos/stream-guide.mp4`).
فيديو تعريفي بأسلوب الإعلانات: مقدمة بالشعار، وعناوين متحركة، وتكبير على واجهة اللعبة الحقيقية، وموسيقى ومؤثرات،
وصوت سعودي من ElevenLabs (صوت Abdulrahman، موديل Eleven v4). يشرح البداية وطور «جاوب أو بادل».

## الصوت
الكلام في `narration.json`. ولّده في ElevenLabs (كله مع `[pause]` بين الجمل أو جملة جملة) وقصّه إلى
`out/<key>.wav`، مع `out/durations.json` (مدة كل جملة بالثواني). بديل بدون ElevenLabs: `synth.py` بصوت آلي فصحى.

## الإخراج (`promo/`)
1. شغّل السيرفر محليًا على 3999 (قاعدة بيانات فيها فئات جغرافيا وكرة قدم وتاريخ، ومنها «ما هي عاصمة الإمارات؟» بـ200 نقطة).
2. `cd scripts/stream-guide/promo && npm i @fontsource/lalezar @fontsource/tajawal` (مرة وحدة).
3. `node capture.cjs` — صور عالية الدقة من الموقع لكل خطوة، مع أماكن العناصر اللي تكبّر عليها الكاميرا (`shots/`).
4. `python3 prepare.py` — الخطوط والشعار الشفاف والصوت و`data.js`.
5. `node preview.cjs 3 20 45` — يكتب `timeline.json` ويصوّر لحظات للمراجعة في `pv/`.
6. `python3 audio.py` — موسيقى ومؤثرات مولّدة بالكود، والصوت فوقها، والموسيقى تنخفض وقت الكلام (`mix.wav`).
7. `node render.cjs` — يرسم `stage.html` إطار إطار (30 إطار/ث، 1920×1080).
8. `ffmpeg -f concat -i render/list.txt -i mix.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 160k -shortest -movflags +faststart ../../../apps/web/public/videos/stream-guide.mp4`

`record.cjs` و`assemble.py` هي الطريقة القديمة (تسجيل الشاشة مع كتابة)، باقية لو احتجتها.
