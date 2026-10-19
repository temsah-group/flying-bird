# Flying Bird — Admin Dashboard

فرونت منفصل (React + Vite) بيكلّم الـ Admin API اللي في السيرفر.

## التشغيل

```
cd admin-dashboard
npm install          (أول مرة بس)
npm run dev
```

بعدين افتح http://localhost:5173 وادخل بـ `ADMIN_PASSWORD` اللي في `server/.env`.

لازم السيرفر يكون شغال الأول (`npm start` من فولدر `flying bird`).

## الإعدادات

ملف `.env` هنا فيه رابط الـ API:

```
VITE_API_URL=http://localhost:3000/api
```

لو السيرفر اترفع على الإنترنت، غيّر الرابط ده.

## نسخة ملف واحد (تفتحها بدبل كليك)

```
npm run build:file
```
بيطلّع ملف واحد `dist-single/index.html`. ده نفس الملف اللي على الديسكتوب باسم `Flying Bird Admin.html`، وبيشتغل من غير `npm run dev`.

رابط السيرفر بيتحط جوه الملف وقت الـ build، فلو غيّرت `VITE_API_URL` لازم تعمل `build:file` تاني.

## الرفع على الإنترنت

1. `npm run build` بيطلّع فولدر `dist/`، وده صفحات ثابتة تقدر ترفعها على أي استضافة (Netlify، Vercel، Nginx...).
2. في `server/.env` حط رابط الداش بورد في `CORS_ORIGINS`، مثلاً `https://admin.mygame.com`، عشان محدش غيرها يقدر يكلّم الـ Admin API من المتصفح.

## الملفات

| الملف | بيعمل إيه |
|---|---|
| `src/api.js` | كل الطلبات للسيرفر، والتوكن بتاع الأدمن، ورسايل الأخطاء بالعربي |
| `src/App.jsx` | بيختار يعرض شاشة الدخول ولا الداش بورد |
| `src/components/LoginPage.jsx` | شاشة باسورد الأدمن |
| `src/components/Dashboard.jsx` | الصفحة الرئيسية: اختيار اللعبة، وتحديث تلقائي كل 15 ثانية |
| `src/components/StatsCards.jsx` | كروت الأرقام: الإجمالي، دخلوا النهارده، لسه ماربطوش جهاز، محاولات من جهاز تاني، المحظورين |
| `src/components/SignupsChart.jsx` | رسم عمليات الدخول في آخر 14 يوم (وفيه زرار يعرضه كجدول) |
| `src/components/UsersTable.jsx` | جدول الحسابات: بحث، فلتر، الجهاز المربوط، وأزرار فك ربط الجهاز / حظر / باسورد / ملاحظة / حذف |
| `src/components/CreateUserModal.jsx` | عمل حساب جديد لاستريمر وعرض اليوزر والباسورد للنسخ |
| `src/components/Modal.jsx` | نافذة التأكيد قبل أي إجراء |
| `src/format.js` | تنسيق التواريخ والأرقام |
| `src/styles.css` | الشكل (فاتح وغامق حسب إعداد الجهاز) |
