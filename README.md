# Flying Bird — Auth

```
flying bird/
├── server/      سيرفر الـ Auth (Express + MongoDB) — يخدم أكتر من لعبة
├── admin-dashboard/  داش بورد الأدمن (React) — فرونت منفصل
├── postman/     كولكشن Postman فيه كل الـ endpoints
├── API.md       شرح كل الـ endpoints
├── SECURITY.md  الأمان: إيه المتأمّن، سيناريوهات الهاكر، و HTTPS
├── DEPLOY.md    رفع السيرفر على Render خطوة بخطوة
└── render.yaml  إعدادات Render
```

## تشغيل السيرفر

```
npm run setup     (أول مرة بس)
npm start
```

ملف `server/.env` لازم يكون فيه:

- `MONGO_URI`
- `MONGO_DB_NAME`
- `JWT_SECRET`
- `ADMIN_PASSWORD`: باسورد دخول الداش بورد

باقي الإعدادات موجودة في `server/.env.example`.

## الفكرة

1. **Login**: السيرفر بيرجّع access token (عمره 15 دقيقة) و refresh token (عمره 30 يوم).
2. **أي طلب**: بيتبعت ومعاه `Authorization: Bearer <access>`.
3. **لما الـ access token يخلص**: الـ client بيعمل `/refresh`، فياخد توكنين جداد، والـ refresh القديم بيبطل يشتغل.
4. **Heartbeat** بيتبعت كل 30 ثانية. ده بيمنع إن نفس الحساب يدخل من جهاز تاني طول ما اللاعب شغال.
5. **لو اللعبة اتقفلت أو وقعت**: بعد دقيقتين، الحساب يقدر يدخل من جهاز تاني.

## لعبة جديدة

1. ضيف اسم اللعبة في `GAMES` في ملف `.env`.
2. اللعبة الجديدة تبعت اسمها في `gameId` مع كل طلب.

## الداش بورد

```
cd admin-dashboard
npm install
npm run dev
```
افتح http://localhost:5173

## Postman

1. Import لملف `postman/Flying-Bird-Auth.postman_collection.json`.
2. في تاب **Variables** حط `adminPassword`.
3. شغّل الطلبات بالترتيب. التوكنات بتتحفظ لوحدها بعد Login و Refresh و Admin login.
4. فولدر **Security (hacker tests)** بيجرب سرقة التوكنات وبيتأكد إن السيرفر بيقفل الجلسة.
