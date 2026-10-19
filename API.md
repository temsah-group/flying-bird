# Flying Bird — API

Base URL: `https://<server>/api` (local: `http://localhost:3000/api`). Everything is JSON.

The game uses two endpoints: `POST /login` then `POST /play`. Accounts are created by the admin from the dashboard (there is no register).

---

## Login (the game)

### `POST /api/login`

```json
{
  "gameId": "flying-bird",
  "username": "streamer1",
  "password": "stream123",
  "deviceId": "A1B2C3D4E5F6A7B8"
}
```

| Field | Rule |
|---|---|
| `gameId` | must be in `GAMES` in the server `.env` |
| `username`, `password` | the ones the admin gave the streamer |
| `deviceId` | 8–64 chars: letters, numbers, `-`. Must be the same value every time on the same PC |

**How the device lock works**

- First successful login → the account is locked to that `deviceId`.
- Same `deviceId` later → OK.
- Any other `deviceId` → `403 WRONG_DEVICE` (and the admin sees an alert).
- Streamer changed PC → admin presses **"فك ربط الجهاز"** and the next login locks to the new PC.

**200 OK**

```json
{
  "ok": true,
  "message": "login successful",
  "token": "eyJhbGciOi...",
  "expiresIn": 86400,
  "user": { "username": "streamer1", "gameId": "flying-bird" }
}
```

`ok: true` = logged in.

**Errors** — always `{ "ok": false, "code": "...", "message": "..." }`

| HTTP | code | Meaning |
|---|---|---|
| 400 | `UNKNOWN_GAME` | `gameId` not in `GAMES` |
| 400 | `INVALID_INPUT` | missing field / bad `deviceId` |
| 401 | `WRONG_CREDENTIALS` | wrong username or password |
| 403 | `WRONG_DEVICE` | account is locked to another device |
| 403 | `BANNED` | banned by admin (`reason` included) |
| 429 | `TOO_MANY_ATTEMPTS` | too many wrong passwords (`retryAfterSec` included) |
| 500 | `SERVER_ERROR` | |

Keep the `token` in memory (no need to save it to a file). It is needed for `/play`.

---

## Play (the game)

### `POST /api/play`

Call it when the streamer presses **PLAY / START**. No body, only headers:

```
Authorization: Bearer <token from /login>
X-Device-Id: <the SAME deviceId sent in /login>
```

**200 OK** → start the game

```json
{ "ok": true, "message": "ok to play", "user": { "username": "streamer1", "gameId": "flying-bird" } }
```

**Errors**

| HTTP | code | Meaning | Game does |
|---|---|---|---|
| 401 | `NO_TOKEN` | no Authorization header | back to login |
| 401 | `TOKEN_EXPIRED` | token older than `TOKEN_HOURS` (24h) | back to login |
| 401 | `TOKEN_INVALID` | bad token / account deleted | back to login |
| 401 | `DEVICE_MISMATCH` | `X-Device-Id` missing or not the login device | back to login |
| 401 | `SESSION_ENDED` | admin changed password / banned / reset device / kicked | back to login |
| 403 | `BANNED` | banned (`reason` included) | show "banned" |

Any 401 = call `/login` again (the player re-enters username + password).

Future endpoints (scores, etc.) use the same two headers.

---

## Admin (dashboard)

All admin requests except login need `Authorization: Bearer <adminToken>`.

| Method | Path | Body / query | Does |
|---|---|---|---|
| POST | `/admin/login` | `{ password }` | returns `token` (ADMIN_PASSWORD from `.env`) |
| GET | `/admin/games` | | list of games |
| GET | `/admin/stats` | `?gameId=` | totals, logins today, not bound, banned, wrong-device tries (7 days), logins per day (14 days) |
| GET | `/admin/users` | `?gameId=&search=&status=&page=&limit=` | list. `status` = `all` `bound` `unbound` `alerts` `banned`. `search` = username or note |
| POST | `/admin/users` | `{ gameId, username, password, note }` | create a streamer account (`409 USERNAME_TAKEN`) |
| GET | `/admin/users/:id` | | account + last 20 login attempts |
| PATCH | `/admin/users/:id` | `{ note }` | edit note |
| POST | `/admin/users/:id/reset-device` | | unlock device (next login locks again) |
| POST | `/admin/users/:id/ban` | `{ reason }` | ban |
| POST | `/admin/users/:id/unban` | | unban |
| POST | `/admin/users/:id/password` | `{ newPassword }` | change password |
| POST | `/admin/users/:id/kick` | | invalidate current tokens |
| POST | `/admin/users/:id/clear-alert` | | hide the wrong-device alert |
| DELETE | `/admin/users/:id` | | delete account + its login history |

User object returned to admin:

```json
{
  "id": "...", "gameId": "flying-bird", "username": "streamer1", "note": "Ahmed - Twitch",
  "deviceId": "A1B2C3D4E5F6A7B8", "deviceBoundAt": "...",
  "lastLoginAt": "...", "lastLoginIp": "...",
  "wrongDevice": { "at": "...", "deviceId": "OTHER-PC" },
  "banned": false, "banReason": "", "bannedAt": null, "createdAt": "..."
}
```

---

## Health

`GET /health` (outside `/api`) → `{ "ok": true, "games": [...] }`
