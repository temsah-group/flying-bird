# Flying Bird — Auth

```
flying bird/
├── server/           سيرفر الـ Auth (Express + MongoDB) — يخدم أكتر من لعبة
├── admin-dashboard/  داش بورد الأدمن (React) — فرونت منفصل
├── postman/          كولكشن Postman
└── API.md            شرح الـ endpoints
```

## الفكرة

1. الأدمن بيعمل حساب للاستريمر من الداش بورد (يوزر + باسورد) ويبعتهوله.
2. اللعبة بتبعت `POST /api/login` فيه اليوزر والباسورد والـ `deviceId`.
3. **أول دخول** بيقفل الحساب على الجهاز ده. بعد كده أي جهاز تاني بياخد `WRONG_DEVICE`.
4. اللعبة تقدر تعمل `/login` كل مرة عايزة تتأكد، والرد `ok: true` معناه مسموح.
5. لو الاستريمر غيّر جهازه، الأدمن بيدوس **فك ربط الجهاز**.
6. الحساب شغال لحد ما الأدمن يحظره أو يمسحه.

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

باقي الإعدادات (`GAMES` و `TOKEN_HOURS` و `LOGIN_LOG_DAYS` ...) موجودة في `server/.env.example`.

## لعبة جديدة

1. ضيف اسم اللعبة في `GAMES` في ملف `.env`.
2. اللعبة الجديدة تبعت اسمها في `gameId`.

## الداش بورد

```
npm run dashboard
```

افتح http://localhost:5173

## Postman

1. اعمل Import لملف `postman/Flying-Bird-Auth.postman_collection.json`.
2. في تاب **Variables** حط `adminPassword`، ولو هتجرب على السيرفر الأونلاين غيّر `baseUrl`.
3. شغّل الطلبات بالترتيب من 1 لـ 21، أو دوس Run collection. التوكنات والـ `userId` بيتحفظوا لوحدهم.
