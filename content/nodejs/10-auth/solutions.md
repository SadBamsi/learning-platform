## Решения

### Задание 1

```js
const [h, p] = token.split(".");
console.log(JSON.parse(Buffer.from(h, "base64url").toString()));
console.log(JSON.parse(Buffer.from(p, "base64url").toString()));
```

Результат: header `{ alg: "HS256", typ: "JWT" }`, payload `{ sub: "42", role: "user", exp: 4102444800 }` (`exp` — это 1 января 2100 г.).

До проверки подписи **ничему в токене доверять нельзя**: payload — просто закодированный JSON, его может сформировать кто угодно. Если злоумышленник заменит `role` на `admin`, подпись перестанет совпадать, и сервер, проверяющий её корректно, отклонит токен. Если же сервер проверку пропускает или принимает `alg: none`, подмена пройдёт.

### Задание 2

```js
import { createHmac, timingSafeEqual } from "node:crypto";

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const sign = (data, secret) => createHmac("sha256", secret).update(data).digest();

export function signJwt(payload, secret, { expiresIn = 900 } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const body = { iat: now, exp: now + expiresIn, ...payload };
  const data = `${b64({ alg: "HS256", typ: "JWT" })}.${b64(body)}`;
  return `${data}.${sign(data, secret).toString("base64url")}`;
}

export function verifyJwt(token, secret, { issuer, audience } = {}) {
  const parts = String(token).split(".");
  if (parts.length !== 3) throw new Error("malformed");
  const [h, p, s] = parts;

  const header = JSON.parse(Buffer.from(h, "base64url").toString());
  if (header.alg !== "HS256") throw new Error("unsupported alg");   // фиксируем алгоритм, none отклоняется

  const expected = sign(`${h}.${p}`, secret);
  const actual = Buffer.from(s, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error("bad signature");

  const claims = JSON.parse(Buffer.from(p, "base64url").toString());
  const now = Math.floor(Date.now() / 1000);
  if (typeof claims.exp !== "number" || claims.exp <= now) throw new Error("expired");
  if (claims.nbf && claims.nbf > now) throw new Error("not yet valid");
  if (issuer && claims.iss !== issuer) throw new Error("bad issuer");
  if (audience && ![].concat(claims.aud ?? []).includes(audience)) throw new Error("bad audience");
  return claims;
}
```

Обратите внимание: `timingSafeEqual` бросает ошибку при разной длине буферов, поэтому длину сравниваем заранее. В продакшене лучше использовать проверенные библиотеки (`jose`, `jsonwebtoken` с явным `algorithms`).

### Задание 3

```js
import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
const scryptAsync = promisify(scrypt);

const PARAMS = { N: 2 ** 15, r: 8, p: 1, keylen: 64 };
const opts = (N, r, p) => ({ N, r, p, maxmem: 128 * N * r * 2 });

export async function hashPassword(password, params = PARAMS) {
  const salt = randomBytes(16);
  const { N, r, p, keylen } = params;
  const key = await scryptAsync(password, salt, keylen, opts(N, r, p));
  return ["scrypt", N, r, p, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password, stored) {
  const [, N, r, p, saltB64, keyB64] = stored.split("$");
  const key = Buffer.from(keyB64, "base64");
  const candidate = await scryptAsync(password, Buffer.from(saltB64, "base64"), key.length, opts(+N, +r, +p));
  return timingSafeEqual(candidate, key);
}

export function needsRehash(stored, params = PARAMS) {
  const [, N, r, p] = stored.split("$");
  return +N < params.N || +r < params.r || +p < params.p;
}

// при логине:
// if (await verifyPassword(pwd, user.hash)) {
//   if (needsRehash(user.hash)) await db.users.update(user.id, { hash: await hashPassword(pwd) });
// }
```

Перехеширование выполняют **при успешном входе**, потому что только тогда у нас есть открытый пароль.

### Задание 4

```js
import { randomBytes, createHash, randomUUID } from "node:crypto";

const sha = (s) => createHash("sha256").update(s).digest("hex");
const tokens = new Map();   // hash(refresh) -> { userId, family, used }
const revokedFamilies = new Set();

export function issue(userId, family = randomUUID()) {
  const refresh = randomBytes(32).toString("base64url");
  tokens.set(sha(refresh), { userId, family, used: false });
  return { access: `access-for-${userId}`, refresh, family };
}

export function refresh(oldToken) {
  const rec = tokens.get(sha(oldToken));
  if (!rec) throw new Error("invalid");
  if (revokedFamilies.has(rec.family)) throw new Error("revoked");
  if (rec.used) {                      // повтор уже использованного токена → кража
    revokedFamilies.add(rec.family);
    throw new Error("reuse detected: family revoked");
  }
  rec.used = true;
  return issue(rec.userId, rec.family);   // новая пара в той же семье
}
```

Сценарии: `r1 = issue(1)`; `r2 = refresh(r1.refresh)` — успех; повторно `refresh(r1.refresh)` — ошибка «reuse detected» и отзыв семьи; затем `refresh(r2.refresh)` — ошибка «revoked». В БД храните хеши токенов, а не сами токены, и срок жизни.

### Задание 5

```js
import http from "node:http";

const cookie = (value, maxAge) =>
  `rt=${value}; HttpOnly; Secure; SameSite=Strict; Path=/auth; Max-Age=${maxAge}`;

http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/login") {
    // ... проверка пароля ...
    res.setHeader("Set-Cookie", cookie("opaque-refresh-token", 7 * 24 * 3600));
    return res.end(JSON.stringify({ access: "..." }));
  }
  if (req.method === "POST" && req.url === "/logout") {
    res.setHeader("Set-Cookie", cookie("", 0));    // Max-Age=0 удаляет cookie
    return res.writeHead(204).end();
  }
  res.writeHead(404).end();
}).listen(3000);
```

Флаги: `HttpOnly` — не читается из JS; `Secure` — только HTTPS; `SameSite=Strict` — не отправляется при кросс-сайтовых запросах; `Path=/auth` — cookie уходит только на эндпоинты обновления токена; `Max-Age` — срок жизни, `0` — удалить. Для удаления нужно указать тот же `Path`/`Domain`, с которыми cookie создана.

### Задание 6

1. Токен в `localStorage` доступен любому скрипту: XSS ⇒ кража токена. Лучше `httpOnly` cookie (с защитой от CSRF) или хранение в памяти.
2. Без списка допустимых алгоритмов возможны `alg: none` и algorithm confusion. Нужно `jwt.verify(token, secret, { algorithms: ["HS256"], issuer, audience })`.
3. SHA-256 быстрый и без соли: перебор и rainbow tables. Нужен argon2id/scrypt/bcrypt, а сравнение — `timingSafeEqual` (у библиотек уже есть `verify`).
4. **IDOR/BOLA**: нет проверки, что заказ принадлежит `req.user`. Нужно `findOne({ id, userId: req.user.id })` и `404/403`.
5. `fromUserId` берётся из тела запроса, и клиент может подставить чужой id. Идентификатор отправителя нужно брать из сессии/токена (`req.user.id`).
6. Cookie без `HttpOnly`, `Secure`, `SameSite`, `Max-Age`: доступна из JS, уходит по HTTP, уязвима к CSRF, непредсказуемый срок жизни.

### Задание 7

Пример ответа:

«Для SPA и API на одном сайте выбрал бы схему с короткоживущим access-токеном (10–15 минут) и refresh-токеном с ротацией. Access держу в памяти приложения и отправляю в `Authorization: Bearer`. Refresh лежит в `httpOnly; Secure; SameSite=Strict` cookie с `Path=/auth`, поэтому XSS его не прочитает, а CSRF почти исключён флагами и проверкой `Origin`. Сервер хранит только хеши refresh-токенов с идентификатором семьи и при повторном использовании токена отзывает всю семью. Пароли — argon2id или scrypt с индивидуальной солью, сравнение за постоянное время, на логин rate limit и MFA. Logout удаляет refresh на сервере и стирает cookie. Авторизацию (роли и владение ресурсами) проверяю на сервере на каждом запросе. Если приложение простое и на одном домене, серверные сессии в Redis с cookie проще и безопаснее, чем JWT».
