# رفع السيرفر على Render (من غير ما جهازك يفضل شغال)

هتاخد حوالي 15 دقيقة أول مرة. محتاج 3 حسابات، كلهم ببلاش: GitHub و Render و MongoDB Atlas (موجود عندك).

---

## 1) Atlas: اسمح للسيرفر يوصل للداتابيز

Render مالوش IP ثابت في الباقة المجانية، فلازم تسمح لأي IP:

1. ادخل على https://cloud.mongodb.com
2. من القايمة اختار **Network Access** ← **Add IP Address**.
3. اختار **Allow Access from Anywhere**، وده بيحط `0.0.0.0/0`، وبعدين **Confirm**.

ماتقلقش، الداتابيز لسه محمية باليوزر والباسورد اللي في `MONGO_URI`.

---

## 2) GitHub: ارفع الكود

**الأسهل: GitHub Desktop**

1. نزّل GitHub Desktop من https://desktop.github.com وسجّل دخول.
2. اختار **File** ← **Add local repository** ← اختار فولدر `flying bird` من الديسكتوب.
3. هيقولك إن ده مش repository، فاضغط **create a repository** ← **Create repository**.
4. اضغط **Publish repository**، و**خليه Private** (علّم على Keep this code private) ← **Publish**.

**قبل ما تدوس Publish، اتأكد** إن `server/.env` و `node_modules` **مش** موجودين في قايمة الملفات. ملف `.gitignore` المفروض يمنعهم، بس بص بعينك برضو.

---

## 3) Render: شغّل السيرفر

1. ادخل على https://render.com واعمل حساب **بـ GitHub**.
2. اضغط **New +** ← **Blueprint**.
3. اختار الـ repo `flying-bird`. Render هيقرا ملف `render.yaml` لوحده.
4. هيطلب منك قيمتين:
   - **MONGO_URI**: انسخه من `server/.env` بتاعك، بالباسورد.
   - **ADMIN_PASSWORD**: باسورد الداش بورد، 10 حروف أو أكتر.
5. اضغط **Apply**، واستنى البناء (من 2 لـ 5 دقايق).
6. لما يخلص هيظهرلك الرابط، شكله كده:
   ```
   https://flying-bird-auth.onrender.com
   ```
7. افتح `https://flying-bird-auth.onrender.com/health` ولازم يظهر `{"ok":true,...}`.

**رابط الـ API** = الرابط ده + `/api`

`JWT_SECRET` بيتعمل عشوائي لوحده على Render، ومش محتاج تعمل حاجة.

---

## 4) بعد الرفع

| فين | تعمل إيه |
|---|---|
| **Postman** | Variables ← `baseUrl` = `https://flying-bird-auth.onrender.com/api` |
| **الداش بورد** | في `admin-dashboard/.env` غيّر `VITE_API_URL` للرابط الجديد، وبعدين `npm run build:file` |
| **مطوّر Unreal** | ابعتله الرابط و `gameId` = `flying-bird` |
| **أي تعديل في الكود** | اعمل Commit و Push من GitHub Desktop، و Render هيرفع النسخة الجديدة لوحده |

---

## الباقة المجانية: لازم تعرف

- السيرفر **بينام** لو مفيش طلبات لمدة حوالي ربع ساعة، وأول طلب بعدها بياخد حوالي دقيقة.
  - طول ما فيه لاعبين، الـ heartbeat بيخليه صاحي.
  - كويسة للتطوير والتجربة.
- **قبل نزول اللعبة**، رقّي لباقة مدفوعة على Render، أو استخدم Railway، عشان يفضل صاحي على طول. الأسعار بتتغير، فبص على موقعهم.

---

## لو حصلت مشكلة

| اللي بيظهر في Logs على Render | الحل |
|---|---|
| `MongoDB connection failed` / `timed out` | الخطوة 1: Atlas Network Access |
| `bad auth` | الباسورد في `MONGO_URI` غلط |
| `JWT_SECRET is missing` | من Environment في Render ضيف `JWT_SECRET` بقيمة طويلة عشوائية |
