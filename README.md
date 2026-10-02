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
