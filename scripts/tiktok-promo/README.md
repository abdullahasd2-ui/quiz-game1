# إعلان تيك توك للعبة الأساسية (1080×1920، 60 إطار، ~83 ثانية)

لقطات حقيقية من اللعبة الأساسية بس (بدون صفحات Kick)، فوق مسرح Motion Graphics، وموسيقى ومؤثرات مولّدة بالكود.

1. قاعدة بيانات للتصوير فيها البنك كامل: `create database promo`، ثم بنفس متغيرات السيرفر مع `DATABASE_URL=.../promo`:
   `migrate.ts` ثم `seed-legacy.ts` ثم `load-bank.ts`، و`update questions set status='approved'` (في قاعدة التصوير بس).
2. شغّل السيرفر عليها على المنفذ 4000.
3. `python3 ../vertical-promo/prepare.py` لـ`fonts.css`، وانسخ `assets/wordmark-t.png` (الشعار بخلفية شفافة). `assets/qr.svg` = رمز QR لـ https://jawabbadel.com/
4. `node capture.cjs` (أو `ONLY=teams,list node capture.cjs`) — يلعب غرف حقيقية لكل الأطوار ويصوّر `shots/`.
5. `python3 -c "open('data.js','w').write('window.SHOTS='+open('shots/shots.json').read()+';')"`
6. `node preview.cjs 1 30 60` — `timeline.json` ولقطات مراجعة.
7. `python3 audio.py` ثم `JOBS=8 node render.cjs` (60 إطار) ثم:
   `ffmpeg -f concat -i render/list.txt -i mix.wav -map 0:v -map 1:a -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -r 60 -c:a aac -b:a 192k -movflags +faststart promo.mp4`
