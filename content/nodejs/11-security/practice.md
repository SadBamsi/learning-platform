## Задания на закрепление

### Задание 1. Найдите уязвимости

В каждом фрагменте найдите уязвимость, назовите её класс и предложите исправление.

```js
// 1
app.get("/users", async (req, res) => {
  const rows = await db.query(`SELECT * FROM users ORDER BY ${req.query.sort}`);
  res.json(rows);
});

// 2
app.get("/search", (req, res) => {
  res.send(`<h1>Результаты по запросу: ${req.query.q}</h1>`);
});

// 3
app.get("/redirect", (req, res) => res.redirect(req.query.url));

// 4
const JWT_SECRET = "supersecret123";

// 5
app.put("/profile", auth, async (req, res) => {
  await db.users.update(req.user.id, req.body);   // в теле может быть { role: "admin" }
  res.sendStatus(204);
});

// 6
app.post("/fetch-preview", async (req, res) => {
  const r = await fetch(req.body.url);
  res.send(await r.text());
});
```

### Задание 2. Path traversal

Напишите статический сервер на `node:http`, отдающий файлы из каталога `public/`. Сначала сделайте уязвимую версию (`path.join`), продемонстрируйте чтение файла вне каталога (`curl --path-as-is 'localhost:3000/..%2Fserver.mjs'`; обычный `/../server.mjs` не сработает, потому что `new URL()` сам нормализует `..`, а закодированный слэш `%2F` проходит до `decodeURIComponent`), затем исправьте.

### Задание 3. Prototype pollution

Воспроизведите «отравление» прототипа через небезопасный `merge` из теории. Затем исправьте функцию тремя способами: (1) фильтрация опасных ключей; (2) `Object.create(null)` в качестве цели; (3) проверка `Object.hasOwn`.

### Задание 4. ReDoS

Измерьте время `/^(a+)+$/.test("a".repeat(n) + "!")` для `n = 20, 22, 24, 26`. Как растёт время? Перепишите регулярное выражение так, чтобы оно давало тот же результат за линейное время. Как защититься, если регулярку нельзя менять?

### Задание 5. Rate limiter

Реализуйте middleware с алгоритмом **token bucket**: ёмкость корзины 10 токенов, пополнение 5 токенов в секунду, ключ — IP клиента. При исчерпании — `429` и заголовок `Retry-After`. Проверьте серией быстрых запросов `curl`.

### Задание 6. CORS

Напишите middleware для `node:http`, который:

- разрешает запросы только с origin из allow-list `["https://app.example.com"]`;
- отвечает на preflight (`OPTIONS`) с нужными заголовками и `204`;
- поддерживает cookie (`Access-Control-Allow-Credentials`);
- добавляет `Vary: Origin`.

Ответьте: почему нельзя ответить `Access-Control-Allow-Origin: *` при `credentials: include`? Почему `curl` не блокируется CORS?

### Задание 7. Ответ для интервью

За 2 минуты расскажите: *«Какие меры вы применяете, чтобы защитить Node.js API перед выходом в продакшен?»* Структурируйте ответ по слоям: вход (валидация), аутентификация/авторизация, данные (SQL), вывод (XSS), транспорт (HTTPS, CORS, CSRF), инфраструктура (секреты, зависимости, лимиты, логи).
