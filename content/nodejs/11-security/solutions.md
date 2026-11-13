## Решения

### Задание 1

1. **SQL-инъекция через `ORDER BY`**: параметризовать имя колонки нельзя. Исправление: allow-list — `const allowed = new Set(["name", "created_at"]); const col = allowed.has(sort) ? sort : "created_at";`. Направление сортировки тоже по списку (`ASC`/`DESC`).
2. **Reflected XSS**: пользовательский ввод подставляется в HTML без экранирования (`?q=<script>…</script>`). Исправление: экранирование HTML-символов или шаблонизатор с автоэкранированием, заголовок `Content-Security-Policy`.
3. **Open redirect**: можно отправить жертву на фишинговый сайт через ссылку вашего домена. Исправление: allow-list доменов или только относительные пути внутри сайта.
4. **Секрет в коде**: попадёт в репозиторий и логи сборки; к тому же слабый. Исправление: переменная окружения/секрет-менеджер, длинный случайный секрет, ротация.
5. **Mass assignment**: клиент передаёт `{ "role": "admin" }`. Исправление: выбирать только разрешённые поля (`const { name, avatar } = req.body`) либо валидировать схемой со строгим списком полей.
6. **SSRF**: сервер ходит по любому URL от клиента (`http://169.254.169.254/…`, `http://localhost:6379`). Исправление: allow-list схем/доменов, проверка IP после DNS-резолва на приватные диапазоны, запрет редиректов, таймаут, ограничение размера ответа.

### Задание 2

Уязвимая версия:

```js
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";

const PUBLIC = path.resolve("public");

http.createServer(async (req, res) => {
  const name = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = path.join(PUBLIC, name);              // УЯЗВИМО: ../ выходит за каталог
  try { res.end(await fs.readFile(file)); } catch { res.writeHead(404).end(); }
}).listen(3000);
```

Исправление:

```js
const file = path.resolve(PUBLIC, "." + path.sep + name);      // нормализуем
if (file !== PUBLIC && !file.startsWith(PUBLIC + path.sep)) {  // остались внутри каталога?
  return res.writeHead(403).end("Forbidden");
}
```

Я проверил на Node 24: уязвимая версия отдаёт `server.mjs` по `curl --path-as-is 'localhost:3000/..%2Fserver.mjs'`, исправленная отвечает `403`.

Проверка префикса с `path.sep` важна: иначе каталог `public-secret` пройдёт проверку `startsWith("…/public")`. Дополнительно: символические ссылки (`fs.realpath`) и null-байт.

### Задание 3

```js
const polluted = JSON.parse('{"__proto__": {"isAdmin": true}}');

function mergeUnsafe(t, s) {
  for (const k in s) { if (typeof s[k] === "object" && s[k] !== null) mergeUnsafe((t[k] ??= {}), s[k]); else t[k] = s[k]; }
}
mergeUnsafe({}, polluted);
console.log(({}).isAdmin);    // true — прототип отравлен

// (1) фильтрация ключей
const BAD = new Set(["__proto__", "constructor", "prototype"]);
function mergeSafe1(t, s) {
  for (const k of Object.keys(s)) {
    if (BAD.has(k)) continue;
    if (typeof s[k] === "object" && s[k] !== null) mergeSafe1((t[k] ??= {}), s[k]); else t[k] = s[k];
  }
}

// (2) цель без прототипа
const target = Object.create(null);

// (3) только собственные свойства (и у источника, и у цели)
function mergeSafe3(t, s) {
  for (const k in s) {
    if (!Object.hasOwn(s, k) || BAD.has(k)) continue;
    if (typeof s[k] === "object" && s[k] !== null) {
      if (!Object.hasOwn(t, k)) t[k] = {};          // не берём «унаследованный» объект у цели
      mergeSafe3(t[k], s[k]);
    } else {
      t[k] = s[k];
    }
  }
}
```

Нюанс: `JSON.parse` создаёт собственное свойство `__proto__`, а `Object.keys` его возвращает, поэтому фильтр ключей обязателен. Проверку нужно делать и на `t[k]`: берите вложенный объект только если он **собственное** свойство цели.

### Задание 4

```js
const re = /^(a+)+$/;
for (const n of [20, 22, 24, 26]) {
  const s = "a".repeat(n) + "!";
  const t = performance.now(); re.test(s);
  console.log(n, Math.round(performance.now() - t), "мс");
}
```

Время растёт **экспоненциально**: каждые +2 символа примерно ×4. Эквивалентное линейное выражение: `/^a+$/` (вложенный квантификатор не нужен). Если менять регулярку нельзя: ограничить длину входа, использовать RE2 (линейное время), выполнять в воркере с таймаутом, проверять регулярки линтером (`safe-regex`, `eslint-plugin-regexp`).

### Задание 5

```js
const buckets = new Map();          // ip -> { tokens, last }
const CAP = 10, RATE = 5;           // 5 токенов/сек

export function rateLimit(req, res, next) {
  const key = req.socket.remoteAddress;
  const now = Date.now();
  const b = buckets.get(key) ?? { tokens: CAP, last: now };
  b.tokens = Math.min(CAP, b.tokens + ((now - b.last) / 1000) * RATE);
  b.last = now;
  if (b.tokens < 1) {
    const wait = Math.ceil((1 - b.tokens) / RATE);
    res.writeHead(429, { "Retry-After": String(wait) }).end("Too Many Requests");
    buckets.set(key, b);
    return;
  }
  b.tokens -= 1;
  buckets.set(key, b);
  next();
}
```

Первые 10 запросов проходят «пачкой», затем ~5 в секунду. Для кластера состояние хранят в Redis (атомарный Lua-скрипт). Периодически чистите `Map` от старых ключей, иначе это утечка памяти. За прокси используйте IP из доверенного `X-Forwarded-For`.

### Задание 6

```js
const ALLOWED = new Set(["https://app.example.com"]);

export function cors(req, res, next) {
  const origin = req.headers.origin;
  res.setHeader("Vary", "Origin");
  if (origin && ALLOWED.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE");
      res.setHeader("Access-Control-Allow-Headers", req.headers["access-control-request-headers"] ?? "Content-Type,Authorization");
      res.setHeader("Access-Control-Max-Age", "600");
      return res.writeHead(204).end();
    }
  } else if (req.method === "OPTIONS") {
    return res.writeHead(403).end();
  }
  next();
}
```

Спецификация запрещает `*` вместе с учётными данными: иначе любой сайт смог бы читать ответы, сделанные с cookie пользователя. `curl` не блокируется, потому что CORS — это политика **браузера**: сервер лишь передаёт заголовки, а решение «показать ли ответ странице» принимает браузер.

### Задание 7

Пример ответа:

«Иду по слоям. Вход: валидация всех данных по схеме (zod/JSON Schema), белые списки полей, ограничение размера тела, rate limit и таймауты. Аутентификация: пароли в argon2id, короткие access-токены и refresh-ротация, MFA, на сервере проверяю права и владение ресурсом на каждый запрос. Данные: только параметризованные запросы и минимальные права пользователя БД. Вывод: автоэкранирование, CSP и санитайзер для HTML. Транспорт: HTTPS и HSTS, `Secure/HttpOnly/SameSite` cookie, CSRF-защита, CORS с allow-list. Инфраструктура: секреты в менеджере секретов, `helmet`, `npm audit` и автообновление зависимостей, запуск в контейнере не от root, структурные логи без секретов, мониторинг и алерты. Ошибки наружу без деталей».
