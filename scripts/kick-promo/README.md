# إعلان صفحة Kick (1080×1920، 60 إطار، ~58 ثانية)

لقطات حقيقية من صفحات Kick بوضع «تجربة بدون Kick» (الستريمر يكتب رسائل الشات بنفسه مثل ما توصل من شات Kick)، فوق مسرح بشكل بث مباشر: نافذة البث وتحتها الشات.

1. نفس قاعدة التصوير والسيرفر على 4000 اللي في `../tiktok-promo/README.md`.
2. `node capture.cjs` — صفحة الستريمر (1280×900) وشاشة البث (1920×1080): الدخول، الاختيار، الأجوبة، النتيجة، المنصة، و«عدّها».
3. `node duel-capture.cjs castle|chain|faza` — «تحدي القنوات» (يحفظ `shots/duel-*.png`).
4. `data.js` من `shots/shots.json` (+ لقطات duel بمقاس 1920×1080)، و`assets/qr.svg` = QR لـ https://jawabbadel.com/kick/quiz
5. `node preview.cjs` ثم `python3 audio.py` ثم `JOBS=8 node render.cjs` ثم دمج `render/list.txt` مع `mix.wav` (H.264، 60 إطار).
