## Решения

### Задание 1

1. `400 Bad Request`
2. `401 Unauthorized`
3. `403 Forbidden`
4. `201 Created` (+ `Location`)
5. `409 Conflict`
6. `422 Unprocessable Content` (многие команды используют и `400`: главное договориться об единой схеме)
7. `429 Too Many Requests` (+ `Retry-After`)
8. `204 No Content`
9. `503 Service Unavailable`
10. `304 Not Modified`

### Задание 2

- `GET /orders/1` — безопасный и идемпотентный.
- `PUT /users/1 {name:"A"}` — идемпотентный: повтор приведёт к тому же состоянию.
- `POST /orders` — **не** идемпотентный: повтор создаст дубликат.
- `DELETE /orders/1` — идемпотентный по состоянию (после первого вызова ресурса нет; статус повторного вызова может быть `404`, но состояние то же).
- `PATCH /counter {inc: 1}` — **не** идемпотентный (относительное изменение). `PATCH {value: 5}` идемпотентен.

Для `POST /orders`: заголовок `Idempotency-Key` + таблица `(key → ответ)` с уникальным индексом: при повторе возвращаем сохранённый результат; либо бизнес-ключ с `UNIQUE`-ограничением.

### Задание 3

```js
import http from "node:http";

function compose(middlewares) {
  return (req, res) => {
    let last = -1;
    const dispatch = async (i) => {
      if (i <= last) throw new Error("next() called multiple times");
      last = i;
      const fn = middlewares[i];
      if (!fn) return;
      await fn(req, res, () => dispatch(i + 1));
    };
    return dispatch(0).catch((err) => {
      console.error(err);
      if (!res.headersSent) res.writeHead(500).end("Internal error");
    });
  };
}

export function createApp() {
  const stack = [];
  return {
    use: (fn) => stack.push(fn),
    listen: (port, cb) => http.createServer(compose(stack)).listen(port, cb),
  };
}

const app = createApp();
app.use(async (req, res, next) => {                    // логирование
  const t = Date.now();
  res.on("finish", () => console.log(req.method, req.url, res.statusCode, `${Date.now() - t}ms`));
  await next();
});
app.use(async (req, res, next) => {                    // JSON-парсер
  if (["POST", "PUT", "PATCH"].includes(req.method)) {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    try { req.body = raw ? JSON.parse(raw) : {}; }
    catch { return res.writeHead(400).end(JSON.stringify({ error: { code: "BAD_JSON", message: "Invalid JSON" } })); }
  }
  await next();
});
app.use((req, res) => res.writeHead(404).end(JSON.stringify({ error: { code: "NOT_FOUND", message: "Not found" } })));
app.listen(3000);
```

В реальном парсере нужно ограничивать размер тела (например, 1 МБ) и проверять `Content-Type`.

### Задание 4

Основа решения:

```js
import http from "node:http";
import { randomUUID } from "node:crypto";

const todos = new Map();
const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(body === undefined ? undefined : JSON.stringify(body));
};
const fail = (res, status, code, message) => send(res, status, { error: { code, message } });

async function readJson(req) {
  let raw = "";
  for await (const c of req) { raw += c; if (raw.length > 1e6) throw Object.assign(new Error("too large"), { status: 413 }); }
  return raw ? JSON.parse(raw) : {};
}
const validTitle = (t) => typeof t === "string" && t.trim().length > 0 && t.length <= 200;

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    const m = url.pathname.match(/^\/todos(?:\/([\w-]+))?$/);
    if (!m) return fail(res, 404, "NOT_FOUND", "Route not found");
    const id = m[1];

    if (!id) {
      if (req.method === "GET") {
        const limit = Math.min(Number(url.searchParams.get("limit") ?? 10), 100);
        const after = url.searchParams.get("after");
        const done = url.searchParams.get("done");
        let list = [...todos.values()];                              // порядок вставки = порядок id
        if (done !== null) list = list.filter((t) => String(t.done) === done);
        if (after) { const i = list.findIndex((t) => t.id === after); list = i >= 0 ? list.slice(i + 1) : []; }
        const items = list.slice(0, limit);
        return send(res, 200, { items, nextCursor: list.length > limit ? items.at(-1).id : null });
      }
      if (req.method === "POST") {
        const body = await readJson(req);
        if (!validTitle(body.title)) return fail(res, 422, "VALIDATION", "title must be 1..200 chars");
        const todo = { id: randomUUID(), title: body.title.trim(), done: false };
        todos.set(todo.id, todo);
        return send(res, 201, todo, { Location: `/todos/${todo.id}` });
      }
      res.setHeader("Allow", "GET, POST");
      return fail(res, 405, "METHOD_NOT_ALLOWED", "Method not allowed");
    }

    const todo = todos.get(id);
    if (!todo) return fail(res, 404, "NOT_FOUND", "Todo not found");
    switch (req.method) {
      case "GET": return send(res, 200, todo);
      case "PATCH": {
        const body = await readJson(req);
        if ("title" in body) { if (!validTitle(body.title)) return fail(res, 422, "VALIDATION", "bad title"); todo.title = body.title.trim(); }
        if ("done" in body) { if (typeof body.done !== "boolean") return fail(res, 422, "VALIDATION", "done must be boolean"); todo.done = body.done; }
        return send(res, 200, todo);
      }
      case "DELETE": todos.delete(id); return send(res, 204);
      default:
        res.setHeader("Allow", "GET, PATCH, DELETE");
        return fail(res, 405, "METHOD_NOT_ALLOWED", "Method not allowed");
    }
  } catch (err) {
    if (err instanceof SyntaxError) return fail(res, 400, "BAD_JSON", "Invalid JSON");
    if (err.status === 413) return fail(res, 413, "TOO_LARGE", "Body too large");
    console.error(err);
    fail(res, 500, "INTERNAL", "Internal error");
  }
}).listen(3000);
```

### Задание 5

```js
import { createHash } from "node:crypto";

function sendWithEtag(req, res, data) {
  const body = JSON.stringify(data);
  const etag = `"${createHash("sha1").update(body).digest("base64url")}"`;
  res.setHeader("ETag", etag);
  res.setHeader("Cache-Control", "private, max-age=0, must-revalidate");
  if (req.headers["if-none-match"] === etag) { res.statusCode = 304; return res.end(); }
  res.writeHead(200, { "Content-Type": "application/json" }).end(body);
}
```

`curl -i localhost:3000/todos/<id>` вернёт `ETag`; повторите с `-H 'If-None-Match: "<etag>"'` и получите `304 Not Modified` без тела.

### Задание 6

Запрос с `OFFSET 5000000` вынужден прочитать и отбросить 5 млн строк, поэтому время растёт линейно с `OFFSET`. Запрос `WHERE id > 5000000` использует индекс и сразу «прыгает» к нужному месту: время почти не зависит от глубины. Недостатки keyset: нет произвольного перехода на страницу N, сложнее при сортировке по нескольким полям; при смене сортировки курсор нужно пересчитывать.

Для `created_at` с дубликатами курсор должен быть **составным**: `(created_at, id)`, сортировка `ORDER BY created_at, id`, условие `WHERE (created_at, id) > ($1, $2)`. Курсор в API обычно кодируют в opaque-строку (base64url), чтобы клиенты не зависели от формата.

### Задание 7

- `POST /getUsers` — глагол в URL и неверный метод. Нужно `GET /users`.
- `GET /deleteUser?id=5` — `GET` обязан быть безопасным: удаление по `GET` может сработать от prefetch/краулера. Нужно `DELETE /users/5`.
- `POST /users/create → 200 {"success": false}` — глагол в URL и «успешный» статус для ошибки. Нужно `POST /users`, при дубликате `409`, при успехе `201`.
- `PUT /users/5/activate` — действие допустимо как под-ресурс-команда, но `PUT` подразумевает замену; чаще `POST /users/5/activation` либо `PATCH /users/5 {active:true}`.
- `/users/5/orders/17/items/3/reviews/8` — слишком глубокая вложенность. Выносите в корень: `GET /reviews/8` (с `orderId`/`itemId` в данных).
