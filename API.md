# Auth API

Base URL: `http://<server>:3000/api` — كل الطلبات والردود JSON.

لو الطلب فشل، الرد بيبقى بالشكل ده:
```json
{ "ok": false, "code": "ERROR_CODE", "message": "..." }
```

---

## POST /register
```json
{ "gameId": "flying-bird", "username": "saleh", "password": "123456" }
```

| Status | الرد |
|---|---|
| 201 | `{ ok: true, user: { username } }` |
| 400 | `INVALID_INPUT`، `UNKNOWN_GAME` |
| 409 | `USERNAME_TAKEN` |

## POST /login
```json
{ "gameId": "flying-bird", "username": "saleh", "password": "123456", "deviceId": "postman-device-001" }
```

`deviceId`: رقم الجهاز، من 8 لـ 64 حرف (حروف إنجليزي وأرقام و `-`). اللعبة بتعمله لوحدها من الكمبيوتر، وفي Postman اكتب أي قيمة ثابتة.

| Status | الرد |
|---|---|
| 200 | `{ ok, accessToken, refreshToken, expiresIn, heartbeatSec, user: { username } }` |
| 401 | `WRONG_CREDENTIALS` |
| 403 | `BANNED` (معاه `reason`) |
| 429 | `TOO_MANY_ATTEMPTS`: 5 باسوردات غلط، فالدخول بيتقفل 15 دقيقة (معاه `retryAfterSec`) |
| 409 | `ALREADY_LOGGED_IN`: الحساب شغال دلوقتي على جهاز تاني |

## POST /refresh
```json
{ "gameId": "flying-bird", "refreshToken": "...", "deviceId": "نفس رقم الجهاز اللي عمل login" }
```

| Status | الرد |
|---|---|
| 200 | نفس رد `/login`، بتوكنين **جداد**. الـ refresh token القديم بيبطل يشتغل |
| 401 | `REFRESH_INVALID`: لازم اللاعب يعمل login تاني |
| 401 | `REFRESH_REUSED`: التوكن ده اتستخدم قبل كده، يعني غالباً اتسرق. **الجلسة بتتقفل** |
| 401 | `DEVICE_MISMATCH`: التوكن ده اتستخدم من جهاز تاني. **الجلسة بتتقفل** |

## POST /heartbeat
Headers:
```
Authorization: Bearer <accessToken>
X-Device-Id: <deviceId>
```

| Status | الرد |
|---|---|
| 200 | `{ ok: true }` |
| 401 | `TOKEN_EXPIRED`، `TOKEN_INVALID`، `SESSION_ENDED`، `NO_TOKEN`، `NO_DEVICE` |
| 401 | `DEVICE_MISMATCH`: التوكن اتستخدم من جهاز تاني، و**الجلسة بتتقفل** |

## GET /me
نفس الـ headers بتاعة `/heartbeat`.

| Status | الرد |
|---|---|
| 200 | `{ ok, user: { username, gameId } }` |
| 401 | زي `/heartbeat` |

## POST /logout
```json
{ "gameId": "flying-bird", "refreshToken": "..." }
```

| Status | الرد |
|---|---|
| 200 | `{ ok: true }`، والحساب بقى متاح لأي جهاز |

---

## أي endpoint محمية في اللعبة (score، save...)
في السيرفر:
```js
const requireAuth = require("./middleware/requireAuth");
app.post("/api/score", requireAuth, async (req, res) => {
  // req.user = اللاعب
});
```

ولازم الطلب يكون فيه `Authorization` و `X-Device-Id`.
ولو رجعت `401` بـ `TOKEN_EXPIRED`، الـ client يعمل `/refresh` ويعيد الطلب.

---

# Admin API

كل الطلبات دي (ما عدا `/admin/login`) لازم يكون فيها:
`Authorization: Bearer <adminToken>`

## POST /admin/login
```json
{ "password": "ADMIN_PASSWORD من .env" }
```

| Status | الرد |
|---|---|
| 200 | `{ ok, token, expiresIn }`، والتوكن بيعيش 12 ساعة |
| 401 | `WRONG_PASSWORD` |
| 429 | `TOO_MANY_ATTEMPTS`: 5 محاولات غلط، فالدخول بيتقفل 5 دقايق |
| 503 | `ADMIN_DISABLED`: مفيش `ADMIN_PASSWORD` في `.env` |

## GET /admin/games
`{ ok, games: ["flying-bird", ...] }`

## GET /admin/stats?gameId=flying-bird
`gameId` اختياري، ولو مش موجود بيجيب كل الألعاب.
```json
{ "ok": true, "stats": {
  "totalUsers": 40, "onlineNow": 10, "bannedUsers": 2, "newToday": 6, "newLast7Days": 32, "securityAlerts": 1,
  "signupsPerDay": [ { "date": "2026-10-18", "count": 6 } ],
  "perGame": [ { "gameId": "flying-bird", "users": 32 } ]
} }
```

## GET /admin/users
Query (كله اختياري):

| Query | القيم |
|---|---|
| `gameId` | اسم اللعبة |
| `search` | جزء من اسم اليوزر |
| `status` | `all`، `online`، `banned`، `alerts` (اللي عندهم تنبيه أمني) |
| `page` | رقم الصفحة، الافتراضي 1 |
| `limit` | عدد اليوزرات في الصفحة، الافتراضي 20 وأقصى حاجة 100 |

الرد:
```json
{ "ok": true, "page": 1, "limit": 20, "total": 40, "pages": 2, "users": [ {
  "id": "...", "gameId": "flying-bird", "username": "falcon",
  "online": true, "deviceId": "...", "lastActive": "...", "lastLoginAt": "...", "createdAt": "...",
  "banned": false, "banReason": "", "bannedAt": null,
  "securityEvent": { "type": "REFRESH_TOKEN_REUSED", "at": "...", "ip": "..." }
} ] }
```

## الإجراءات على يوزر

| Method | Endpoint | Body | بيعمل إيه |
|---|---|---|---|
| GET | `/admin/users/:id` | — | بيانات يوزر واحد |
| POST | `/admin/users/:id/kick` | — | يطلّعه من اللعبة دلوقتي |
| POST | `/admin/users/:id/ban` | `{ reason }` | يطلّعه ويمنعه يدخل تاني (login بيرجع `403 BANNED`) |
| POST | `/admin/users/:id/unban` | — | يفك الحظر |
| POST | `/admin/users/:id/password` | `{ newPassword }` | باسورد جديد، ويطلّعه من اللعبة |
| POST | `/admin/users/:id/clear-alert` | — | إخفاء التنبيه الأمني بعد ما الأدمن يراجعه |
| DELETE | `/admin/users/:id` | — | حذف نهائي |

لو اليوزر مش موجود، الرد `404 NOT_FOUND`.
