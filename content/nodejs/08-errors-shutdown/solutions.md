## Решения

### Задание 1

- **A — нет.** Ошибка бросается позже, в колбэке таймера, когда `try/catch` уже завершён. Результат — `uncaughtException`, процесс завершится с кодом 1.
- **B — нет.** `Promise.reject` не бросает синхронно; без обработчика получится `unhandledRejection` → по умолчанию процесс падает.
- **C — да.** `await` превращает отклонение в исключение внутри `try`.
- **D — нет.** Вызов `f()` без `await` возвращает отклонённый промис; синхронного исключения нет. Нужно `await f()` либо `.catch`.

### Задание 2

```js
export class AppError extends Error {
  constructor(message, { status = 500, code = "INTERNAL", expose = false, cause } = {}) {
    super(message, { cause });
    this.name = new.target.name;
    Object.assign(this, { status, code, expose });
  }
}
export class NotFoundError extends AppError {
  constructor(what) { super(`${what} not found`, { status: 404, code: "NOT_FOUND", expose: true }); }
}
export class ValidationError extends AppError {
  constructor(message, details) {
    super(message, { status: 422, code: "VALIDATION", expose: true });
    this.details = details;
  }
}

export function toHttp(err) {
  if (err instanceof AppError) {
    return {
      status: err.status,
      body: { error: { code: err.code, message: err.expose ? err.message : "Internal error", details: err.details } },
    };
  }
  return { status: 500, body: { error: { code: "INTERNAL", message: "Internal error" } } };
}
```

### Задание 3

```js
import http from "node:http";
import { NotFoundError, toHttp } from "./errors.mjs";

const handle = (fn) => async (req, res) => {
  try {
    const data = await fn(req);
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(data));
  } catch (err) {
    const { status, body } = toHttp(err);
    if (status >= 500) console.error(err);         // логируем только неожиданное
    res.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(body));
  }
};

const routes = {
  "/ok": handle(async () => ({ ok: true })),
  "/missing": handle(async () => { throw new NotFoundError("order"); }),
  "/bug": handle(async () => { null.x; }),         // TypeError → 500 без деталей клиенту
};

http.createServer((req, res) => (routes[req.url] ?? handle(async () => { throw new NotFoundError("route"); }))(req, res)).listen(3000);
```

### Задание 4

```js
import http from "node:http";

const server = http.createServer((req, res) => {
  if (req.url === "/slow") return setTimeout(() => res.end("done\n"), 5000);
  res.end("ok\n");
}).listen(3000, () => console.log("pid", process.pid));

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal}: stop accepting, waiting for in-flight requests`);

  const timer = setTimeout(() => { console.error("timeout, forced exit"); process.exit(1); }, 10_000);
  timer.unref();

  server.close((err) => {
    if (err) { console.error(err); process.exit(1); }
    console.log("all connections closed");
    process.exit(0);
  });
  server.closeIdleConnections();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
```

`curl localhost:3000/slow` получит `done`, новый запрос во время остановки завершится ошибкой соединения, процесс выйдет с кодом 0.

### Задание 5

```js
process.on("unhandledRejection", (reason) => { console.error("unhandledRejection", reason); process.exit(1); });
process.on("uncaughtException", (err, origin) => { console.error("uncaughtException", err, origin); process.exit(1); });
```

- (а) и (б) — код **1** (даже без наших обработчиков; с ними мы сами завершаем процесс с кодом 1).
- (в) Если обработчик `uncaughtException` только логирует и не вызывает `exit`/не выставляет `process.exitCode`, процесс может завершиться с кодом **0**, а оркестратор решит, что всё хорошо. Это одна из причин не «глотать» ошибки в глобальном обработчике.

Проверьте самостоятельно через `echo $?`.

### Задание 6

```js
import { setTimeout as sleep } from "node:timers/promises";

const RETRYABLE_CODES = new Set(["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "EAI_AGAIN"]);
const isRetryable = (err) =>
  RETRYABLE_CODES.has(err.code) || err.status === 503 || err.status === 429;

export async function withRetry(fn, { retries = 3, baseDelay = 100, isRetryable: check = isRetryable } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      if (attempt >= retries || !check(err)) throw err;   // TypeError и 4xx — сразу наружу
      const jitter = Math.random() * baseDelay;
      await sleep(baseDelay * 2 ** attempt + jitter);
    }
  }
}
```

Повторять можно только идемпотентные операции (GET, PUT с ключом идемпотентности), иначе повтор может выполнить действие дважды (например, списание).

### Задание 7

Пример ответа:

«Деплой делаем rolling-обновлением. Оркестратор поднимает новые поды и ждёт readiness-пробу, потом убирает старый под из балансировки и посылает ему `SIGTERM`. Процесс по сигналу переводит `/ready` в 503, вызывает `server.close()` и `closeIdleConnections()`, то есть перестаёт принимать новые соединения и дожидается текущих запросов, затем закрывает пул БД, Redis и очереди и выходит с кодом 0. Есть страховочный таймаут: если за N секунд не успели, закрываем соединения принудительно. `terminationGracePeriodSeconds` в Kubernetes больше нашего таймаута, иначе процесс убьют `SIGKILL`. Node-процесс должен быть PID 1 или запускаться через init, чтобы сигнал дошёл. Для WebSocket отправляем клиентам close-кадр, чтобы они переподключились к другому инстансу».
