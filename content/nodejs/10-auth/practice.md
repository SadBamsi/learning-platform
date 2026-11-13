## Задания на закрепление

Файлы — `.mjs`, используйте только `node:crypto` и стандартную библиотеку.

### Задание 1. Читаем JWT

Раскодируйте payload токена, не используя библиотек (подсказка: `Buffer.from(part, "base64url")`):

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0MiIsInJvbGUiOiJ1c2VyIiwiZXhwIjo0MTAyNDQ0ODAwfQ.signature
```

Ответьте: что из содержимого токена можно считать доверенным до проверки подписи? Что изменится, если злоумышленник заменит `role` на `admin`?

### Задание 2. Свой HS256

Реализуйте `signJwt(payload, secret, { expiresIn })` и `verifyJwt(token, secret, { issuer, audience })` на `node:crypto` (`createHmac`, `timingSafeEqual`). Требования: фиксированный алгоритм HS256 (токен с другим `alg` отклоняется, включая `none`), проверка `exp`, `nbf`, `iss`, `aud`, сравнение подписи за постоянное время.

### Задание 3. Хеширование паролей

Реализуйте `hashPassword`/`verifyPassword` на `scrypt` (как в теории), но добавьте параметры стоимости в строку хеша (`scrypt$N$r$p$salt$key`) и функцию `needsRehash(stored)`, возвращающую `true`, если параметры устарели. Как использовать её при логине?

### Задание 4. Refresh с ротацией

Реализуйте in-memory хранилище refresh-токенов с ротацией и **reuse detection**:

- `issue(userId)` → `{ access, refresh }`, refresh хранится в виде хеша;
- `refresh(oldToken)` → новая пара; старый токен помечается использованным;
- повторное предъявление уже использованного токена отзывает всю цепочку («семью») пользователя.

Проверьте сценарии: нормальное обновление; повтор старого токена; использование нового токена после обнаружения кражи.

### Задание 5. Cookie без ошибок

Напишите на `node:http` маршруты `POST /login` (выдаёт refresh-cookie) и `POST /logout` (сбрасывает её). Укажите флаги `HttpOnly`, `Secure`, `SameSite`, `Path`, `Max-Age`. Объясните назначение каждого флага и как удалить cookie.

### Задание 6. Найдите уязвимости

Что не так в каждом фрагменте?

```js
// 1
localStorage.setItem("token", jwt);

// 2
const payload = jwt.verify(token, process.env.SECRET);       // библиотека допускает любой алгоритм из заголовка

// 3
if (user.passwordHash === sha256(req.body.password)) login();

// 4
app.get("/orders/:id", auth, async (req, res) => {
  res.json(await db.orders.findById(req.params.id));
});

// 5
app.post("/transfer", auth, (req, res) => {
  transfer(req.body.fromUserId, req.body.to, req.body.amount);
});

// 6
res.setHeader("Set-Cookie", `sid=${sid}`);
```

### Задание 7. Ответ для интервью

Объясните вслух за 2 минуты: *«Спроектируйте аутентификацию для SPA на React + API на Node.js»*. Упомяните: тип токенов, хранение, refresh, CSRF/XSS, пароли, logout, отзыв.
