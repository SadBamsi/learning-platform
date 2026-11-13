## Решения

### Задание 1

```js
// slugify.mjs
export function slugify(str) {
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")    // всё, кроме букв и цифр (любой алфавит) → дефис
    .replace(/^-+|-+$/g, "");           // убираем дефисы по краям
}
```

```js
// slugify.test.mjs
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { slugify } from "./slugify.mjs";

describe("slugify", () => {
  it("превращает пробелы в дефисы и опускает регистр", () => assert.equal(slugify("Hello World"), "hello-world"));
  it("схлопывает лишние пробелы", () => assert.equal(slugify("  a   b  "), "a-b"));
  it("заменяет спецсимволы", () => assert.equal(slugify("Node.js & Co!"), "node-js-co"));
  it("пустая строка → пустая строка", () => assert.equal(slugify(""), ""));
  it("сохраняет кириллицу", () => assert.equal(slugify("Привет мир"), "привет-мир"));
});
```

Если требуется транслитерация, тест нужно поменять первым (красный), а затем менять реализацию.

### Задание 2

```js
// parse.mjs
import { readFile } from "node:fs/promises";
export async function parseJsonFile(path) { return JSON.parse(await readFile(path, "utf8")); }
```

```js
// parse.test.mjs
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseJsonFile } from "./parse.mjs";

describe("parseJsonFile", () => {
  let dir;
  before(async () => { dir = await mkdtemp(path.join(tmpdir(), "t-")); });
  after(() => rm(dir, { recursive: true, force: true }));

  it("читает корректный JSON", async () => {
    const f = path.join(dir, "ok.json"); await writeFile(f, '{"a":1}');
    assert.deepEqual(await parseJsonFile(f), { a: 1 });
  });
  it("ENOENT для несуществующего файла", async () => {
    await assert.rejects(() => parseJsonFile(path.join(dir, "nope.json")), { code: "ENOENT" });
  });
  it("SyntaxError для битого JSON", async () => {
    const f = path.join(dir, "bad.json"); await writeFile(f, "{oops");
    await assert.rejects(() => parseJsonFile(f), SyntaxError);
  });
});
```

### Задание 3

```js
import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { NotificationService } from "./notification.mjs";

describe("NotificationService", () => {
  const make = (user) => {
    const mailer = { send: mock.fn(async () => {}) };
    const userRepo = { findById: mock.fn(async () => user) };
    return { svc: new NotificationService({ mailer, userRepo }), mailer, userRepo };
  };

  it("отправляет письмо пользователю с email", async () => {
    const { svc, mailer } = make({ id: 1, email: "a@b.c" });
    assert.equal(await svc.notify(1, "hi"), true);
    assert.equal(mailer.send.mock.callCount(), 1);
    assert.deepEqual(mailer.send.mock.calls[0].arguments, ["a@b.c", "hi"]);
  });
  it("не отправляет, если нет email", async () => {
    const { svc, mailer } = make({ id: 1 });
    assert.equal(await svc.notify(1, "hi"), false);
    assert.equal(mailer.send.mock.callCount(), 0);
  });
  it("бросает ошибку, если пользователь не найден", async () => {
    const { svc, mailer } = make(null);
    await assert.rejects(() => svc.notify(9, "hi"), /User not found/);
    assert.equal(mailer.send.mock.callCount(), 0);
  });
});
```

### Задание 4

```js
export function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}
```

```js
import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { debounce } from "./debounce.mjs";

describe("debounce", () => {
  it("срабатывает один раз с аргументами последнего вызова", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const fn = mock.fn();
    const d = debounce(fn, 100);
    d(1); d(2); d(3);
    t.mock.timers.tick(99);
    assert.equal(fn.mock.callCount(), 0);          // ещё рано
    t.mock.timers.tick(1);
    assert.equal(fn.mock.callCount(), 1);
    assert.deepEqual(fn.mock.calls[0].arguments, [3]);
  });
  it("вызов после паузы срабатывает отдельно", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const fn = mock.fn();
    const d = debounce(fn, 100);
    d("a"); t.mock.timers.tick(100);
    d("b"); t.mock.timers.tick(100);
    assert.equal(fn.mock.callCount(), 2);
  });
});
```

### Задание 5

```js
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "./todo-server.mjs";     // фабрика, возвращающая http.Server без listen

describe("todos API", () => {
  let server, base;
  before(async () => {
    server = createServer();
    await new Promise((r) => server.listen(0, r));
    base = `http://localhost:${server.address().port}`;
  });
  after(() => new Promise((r) => { server.close(r); server.closeAllConnections(); }));

  const post = (body) => fetch(`${base}/todos`, { method: "POST", body: JSON.stringify(body) });

  it("создаёт todo: 201 и Location", async () => {
    const res = await post({ title: "buy milk" });
    assert.equal(res.status, 201);
    const todo = await res.json();
    assert.equal(res.headers.get("location"), `/todos/${todo.id}`);
  });
  it("валидация: 422 на пустой title", async () => {
    assert.equal((await post({ title: "" })).status, 422);
  });
  it("404 для несуществующего id", async () => {
    assert.equal((await fetch(`${base}/todos/nope`)).status, 404);
  });
});
```

Для этого сервер нужно экспортировать как фабрику (`createServer()` без вызова `listen`), чтобы тест сам выбирал порт и закрывал его.

### Задание 6

Тест зависит от реального времени: он медленный (целая секунда на один тест), а проверка стоит ровно на границе срока. Таймер и `Date.now()` — разные часы: `setTimeout` срабатывает не точно, и на загруженной машине (CI) момент проверки относительно границы `exp` плавает, поэтому результат на границе нестабилен. Решение — управлять временем:

```js
test("кэш протухает через 1 секунду", (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
  const cache = new TtlCache(1000);       // использует Date.now() внутри
  cache.set("a", 1);
  t.mock.timers.tick(999);
  assert.equal(cache.get("a"), 1);        // граница: ещё жив
  t.mock.timers.tick(1);
  assert.equal(cache.get("a"), undefined);
});
```

Тест выполняется мгновенно и детерминированно, а заодно проверяет границу.

### Задание 7

Пример ответа:

«Основа — unit-тесты на бизнес-логику: быстрые, без БД и сети, зависимости внедряются через конструктор, поэтому моки нужны только на границах (почта, внешние API, время). Над ними — интеграционные тесты HTTP-слоя: поднимаю приложение на случайном порту и проверяю контракты эндпоинтов (статусы, формат ошибок, валидацию, авторизацию), БД — настоящая PostgreSQL в контейнере, миграции перед запуском, изоляция данных транзакцией с откатом. Несколько e2e-сценариев (регистрация, оплата) через Playwright. Для сервисов, общающихся друг с другом, добавляю контрактные тесты. Всё запускается в CI на каждый PR: unit первыми, чтобы падать быстро; flaky-тесты не терплю, а чиню или удаляю. Покрытие смотрю как индикатор незатронутых участков, а не как цель: важнее граничные случаи и регрессии».
