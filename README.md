# جاوب أو بادل

- `index.html` — النسخة القديمة من اللعبة (Firebase)، باقية كما هي للمقارنة.
- `apps/server` — الباك إند: API الأسئلة والفئات ولوحة التحكم، وسيرفر اللعب المباشر (TypeScript + Fastify + Socket.IO + PostgreSQL).
- `apps/web` — اللعبة على `/` ولوحة التحكم على `/admin` (React + Vite + Tailwind + shadcn/ui).
- `packages/shared` — كود مشترك بين السيرفر والواجهة: قواعد النقاط وشكل البيانات.

## التشغيل محليًا

```bash
npm install
npm run db:up                                   # PostgreSQL على المنفذ 5434 (Docker)
cp apps/server/.env.example apps/server/.env    # ثم ضع JWT_SECRET عشوائي
npm run db:migrate -w @quiz/server              # إنشاء الجداول
npm run seed:legacy -w @quiz/server             # نقل أسئلة index.html + استخراج صورها
npm run admin:create -w @quiz/server -- you@example.com 'كلمة-مرور-طويلة'
npm run dev:server                              # API على http://localhost:3000
npm run dev:web                                 # اللعبة على http://localhost:5173 ولوحة التحكم على /admin
```

للإنتاج: `npm run build` ثم `npm start -w @quiz/server`، والسيرفر يقدّم لوحة التحكم المبنية من `apps/web/dist` على نفس المنفذ.

الاختبارات: `npm test` · فحص الأنواع: `npm run typecheck`

بعد تعديل `apps/server/src/db/schema.ts`: `npm run db:generate -w @quiz/server` ثم `db:migrate`.

## بنك الأسئلة

أسئلة مقترحة (من كوديكس أو من ملف) تدخل بحالة «بانتظار المراجعة»، ولا تظهر في اللعبة حتى يعتمدها المشرف من صفحة `/admin/bank`. التعليمات وصيغة الملفات في [`bank/README.md`](bank/README.md)، والتحميل: `npm run bank:load -w @quiz/server`.

## النشر (Docker)

الصورة فيها السيرفر والواجهة المبنية معًا، والترحيلات تتطبّق تلقائيًا عند كل تشغيل. ملفات الإنتاج في `deploy/`:

```bash
docker build --platform linux/amd64 -t quiz-game:latest .   # من جذر المشروع
cd deploy
cp .env.example .env                                         # ثم املأ POSTGRES_PASSWORD و JWT_SECRET
docker compose up -d                                         # التطبيق على 127.0.0.1:3100 + PostgreSQL
docker compose exec app node --import tsx src/scripts/seed-legacy.ts
docker compose exec app node --import tsx src/scripts/create-admin.ts you@example.com 'كلمة-مرور-طويلة'
```

التطبيق يشتغل من جذر النطاق فقط، فيحتاج نطاقًا (أو نطاقًا فرعيًا) خاصًا به. `deploy/nginx.conf` إعداد Nginx على السيرفر (مع WebSocket)، وبعده `certbot --nginx` لشهادة SSL. البيانات في مجلدَي Docker `pgdata` و`uploads`.

### النشر التلقائي (GitHub Actions)

كل دمج في `main` يشغّل [.github/workflows/deploy.yml](.github/workflows/deploy.yml): الاختبارات، ثم بناء الصورة على GitHub، ونقلها للسيرفر بـ SSH إلى `/opt/quiz`، وإعادة التشغيل مع فحص `/api/health`. السيرفر ما يبني شي. التغييرات في `apps/mobile` وملفات `.md` بس ما تشغّل النشر، ويمكن تشغيله يدويًا من تبويب Actions.

تجهيز لمرة وحدة من جذر المشروع: `deploy/bootstrap.sh <مستخدم-SSH>`. يحتاج دخول SSH للسيرفر و`gh` مسجل بحساب له صلاحية على المستودع. السكربت يسوي التالي:
- يجهز `/opt/quiz` على السيرفر ويولّد `.env` بأسرار عشوائية.
- يضبط Nginx وشهادة SSL لـ `jawabbadel.com` (من خلال [deploy/server-setup.sh](deploy/server-setup.sh)).
- يولّد مفتاح نشر مخصص، ويحفظ `SSH_HOST` و`SSH_USER` و`SSH_PRIVATE_KEY` في أسرار GitHub.

بعدها يكفي الدمج في `main`، أو `gh workflow run deploy.yml --ref main`.

## تطبيق الجوال (`apps/mobile`)

تطبيق iOS وAndroid للاعبين فقط (بدون الإدارة) مبني بـ Capacitor. يعيد استخدام شاشات اللعبة من `apps/web/src/game`، ويستبدل `@/lib/native` بنسخة فيها المشاركة والاهتزاز. يتصل بالسيرفر على `VITE_SERVER_URL` (في `apps/mobile/.env` القيمة `https://jawabbadel.com`، وفي `.env.development` القيمة `http://localhost:3000`). السيرفر يسمح لأصول التطبيق عبر `APP_ORIGINS`.

```bash
cd apps/mobile
npm run build        # بناء الويب + cap sync
npm run ios          # فتح Xcode
npm run android      # فتح Android Studio
npm run assets       # إعادة توليد الأيقونات وشاشة البداية من assets/
```

- Android يحتاج JDK 21: `export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home` ثم `cd android && ./gradlew assembleDebug`.
- iOS: المعرّف `com.jawabbadel.app` والفريق `77T6JDYJ62`. للرفع على TestFlight ارفع `CURRENT_PROJECT_VERSION` ثم Product ← Archive ← Distribute App.

## اللعب المباشر

السيرفر هو الحكم: يسحب سؤالًا عشوائيًا مفعّلًا لكل خانة من القاعدة، يخلط الخيارات، يدير المؤقتات (60 ثانية للقرار و60 للإجابة)، ويحسب النقاط. الجهاز يرسل اختياره فقط ويستقبل حالة الغرفة الخاصة به، فلا يعرف قرار الخصم ولا الإجابة الصحيحة قبل النتيجة.

- كل متصفح له معرّف ثابت يحجز مقعده، فالتحديث أو انقطاع النت يرجّعه لنفس الفريق تلقائيًا.
- الفئة تظهر للاختيار فقط إذا فيها سؤال مفعّل لكل النقاط (100–500).
- أسئلة نوع «صورة» تظهر مغبّشة حتى النتيجة، و«اكتشف الصورة/الزوم» تعرض صورة الكشف مع النتيجة.
- الغرف في ذاكرة السيرفر: شغّل نسخة واحدة من السيرفر، والغرف تنحذف بعد 30 دقيقة بدون نشاط.

الأحداث (Socket.IO): `room:create` · `room:join` · `room:leave` · `game:start` · `game:pick` · `game:action` · `game:answer` · `game:next` ← والسيرفر يرسل `room:state` و`room:closed`. الأنواع في `packages/shared/src/game.ts`.

## الـ API

| المسار | الوصف |
|---|---|
| `GET /api/categories` | الفئات المفعّلة، مع `playable` إذا كان فيها سؤال لكل مستوى نقاط |
| `POST /api/admin/login` · `logout` · `GET me` | جلسة المشرف (cookie) |
| `GET/POST /api/admin/categories` · `PATCH/DELETE /:id` | إدارة الفئات |
| `GET/POST /api/admin/questions` · `GET/PATCH/DELETE /:id` | إدارة الأسئلة (`?categoryId&search&active&page&pageSize`) |
| `POST /api/admin/questions/import` | استيراد جماعي `{questions:[{categorySlug,...}]}` — الكل أو لا شيء |
| `POST /api/admin/upload` | رفع صورة (multipart، حتى 5MB) ← `{url}` |
| `GET /api/admin/stats/coverage` | عدد الأسئلة المفعّلة لكل فئة × نقاط |
