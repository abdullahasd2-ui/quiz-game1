# الفيديو الطولي لتيك توك (32 ثانية، 1080×1920)

نفس طريقة `../main-promo` بس طولي: جوال كبير بلقطات حقيقية من اللعبة، وموسيقى ومؤثرات مولّدة بالكود على توقيت المشاهد.

1. شغّل السيرفر على 3999 وقاعدة البيانات فيها جغرافيا وكرة قدم وتاريخ (أول سؤال جغرافيا بـ200: «ما هي عاصمة الإمارات؟»).
2. `python3 prepare.py` (الخطوط والشعار)، وانسخ الشعار بالاسم `assets/wordmark-t.png` (نفس طريقة إزالة الخلفية من `apps/web/public/icons/app-icon-wordmark.png`).
3. `PGPASSWORD=quiz node capture.cjs` — يلعب غرفة بين فريقين ويصوّر (`shots/`).
4. `python3 -c "import json;open('data.js','w').write('window.SHOTS='+open('shots/shots.json').read()+';')"`
5. `node preview.cjs 3 10 20` — `timeline.json` ولقطات مراجعة في `pv/`.
6. `python3 audio.py` ثم `JOBS=6 node render.cjs` ثم:
   `ffmpeg -f concat -i render/list.txt -i mix.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -t 32 -movflags +faststart promo-vertical.mp4`
