> **Ответ за 30 секунд.** Ошибки делят на **операционные** (ожидаемые сбои среды: таймаут, `ECONNREFUSED`, невалидный ввод, 404 — их обрабатывают и продолжают работу) и **программные** (баги: `TypeError`, нарушенный инвариант — состояние процесса ненадёжно, лучше залогировать и перезапустить). Синхронный код ловят `try/catch`, промисы и `async/await` — `.catch`/`try/catch` с `await`, колбэки — первым аргументом `err`, события — `on('error')`. Глобальные `uncaughtException` и `unhandledRejection` — **последний рубеж**: залогировать и **завершить процесс**, а не продолжать работать. На сигнал `SIGTERM` сервис должен остановиться **gracefully**: перестать принимать новые соединения, дождаться текущих запросов, закрыть БД и очереди, выйти с кодом 0, уложившись в таймаут.

## Что именно спрашивают

- «Как обрабатывать ошибки в Node.js? Чем отличаются sync, callback, promise?»
- «Что делать при `uncaughtException`? Можно ли продолжать работу?»
- «Что такое graceful shutdown и как его реализовать?»
- «Чем операционные ошибки отличаются от программных?»
- «Как организовать обработку ошибок в Express/Fastify?»

## Типы ошибок

| | Операционные | Программные (баги) |
|---|---|---|
| Примеры | недоступна БД, таймаут запроса, невалидный JSON от клиента, нет файла | `undefined is not a function`, неверные аргументы, нарушенные инварианты |
| Причина | внешняя среда | ошибка кода |
| Реакция | обработать: ретрай, 4xx/5xx ответ, fallback | залогировать, **перезапустить** процесс; исправить код |

Идея: на программную ошибку процесс уже не гарантирует корректное состояние (половина операций выполнена, ресурсы не освобождены), поэтому безопаснее «упасть быстро» и дать супервизору (Kubernetes, PM2, systemd) поднять новый экземпляр.

## Способы обработки

```js
// 1) синхронно
try { JSON.parse(input); } catch (err) { /* ... */ }

// 2) колбэки: error-first
fs.readFile(path, (err, data) => { if (err) return handle(err); });

// 3) промисы
fetchUser().then(use).catch(handle);

// 4) async/await
try { await fetchUser(); } catch (err) { /* ловит и отклонённые промисы */ }

// 5) события
socket.on("error", handle);   // без обработчика — исключение
```

`try/catch` **не ловит** ошибки в асинхронных колбэках, запланированных внутри него:

```js
try {
  setTimeout(() => { throw new Error("boom"); }, 0); // выбросится позже, вне try
} catch {}   // не сработает → uncaughtException
```

## Свои классы ошибок

```js
class AppError extends Error {
  constructor(message, { status = 500, code = "INTERNAL", cause, expose = false } = {}) {
    super(message, { cause });          // cause — стандарт ES2022: сохраняем исходную ошибку
    this.name = new.target.name;
    this.status = status;
    this.code = code;
    this.expose = expose;               // можно ли показывать message клиенту
  }
}
class NotFoundError extends AppError {
  constructor(what) { super(`${what} not found`, { status: 404, code: "NOT_FOUND", expose: true }); }
}

try { await db.query(sql); }
catch (err) { throw new AppError("failed to load order", { cause: err }); } // оборачиваем, не теряя первопричину
```

Принципы:

- Бросайте только `Error` (или наследников), не строки: у них есть стек.
- Добавляйте контекст через `cause`, а не теряйте исходную ошибку.
- Различайте ошибки по `code`/классу, а не по тексту сообщения.
- Не показывайте клиенту внутренние детали (стек, SQL): логируйте у себя, клиенту — безопасное сообщение и идентификатор запроса.

## Ошибки в HTTP-сервисах

Express: централизованный error middleware с **четырьмя** аргументами, регистрируется **последним**.

```js
app.get("/orders/:id", async (req, res, next) => {
  try { res.json(await getOrder(req.params.id)); }
  catch (err) { next(err); }              // в Express 4 async-ошибки нужно передавать в next вручную
});

app.use((err, req, res, next) => {
  const status = err.status ?? 500;
  if (status >= 500) logger.error({ err, reqId: req.id });
  res.status(status).json({ error: { code: err.code ?? "INTERNAL", message: err.expose ? err.message : "Internal error" } });
});
```

В Express 5 отклонённые промисы из async-обработчиков передаются в error middleware автоматически; в Express 4 для этого нужна обёртка или библиотека. Fastify обрабатывает async-обработчики из коробки (`setErrorHandler`).

## Глобальные обработчики: последний рубеж

```js
process.on("uncaughtException", (err, origin) => {
  logger.fatal({ err, origin }, "uncaught exception");
  shutdown(1);                      // НЕ продолжаем работу
});
process.on("unhandledRejection", (reason) => {
  logger.fatal({ reason }, "unhandled rejection");
  shutdown(1);
});
```

- Начиная с Node 15 режим по умолчанию — `throw`: необработанное отклонение без обработчика превращается в `uncaughtException`, процесс завершается с кодом 1.
- Документация Node.js прямо указывает: после `uncaughtException` **небезопасно** возобновлять нормальную работу. Корректное использование обработчика — синхронная очистка ресурсов перед выходом.
- Если в обработчике `uncaughtException` не выставить `process.exitCode`, процесс завершится с кодом 0 — частая ловушка: оркестратор «увидит» успешный выход.

## Graceful shutdown

**Зачем.** При деплое, масштабировании, остановке пода оркестратор шлёт процессу `SIGTERM`, ждёт (в Kubernetes по умолчанию 30 секунд) и затем убивает `SIGKILL`. Если просто умереть, оборвутся активные запросы, транзакции, останутся неподтверждённые сообщения в очереди.

**Алгоритм.**

1. Получить `SIGTERM`/`SIGINT`.
2. Перестать принимать новые соединения (`server.close()`), `/ready` начинает отвечать 503, чтобы балансировщик убрал инстанс.
3. Дождаться завершения текущих запросов; закрыть простаивающие keep-alive-соединения (`server.closeIdleConnections()`).
4. Закрыть ресурсы в обратном порядке создания: очереди, кэш, пул соединений БД.
5. Завершить процесс (`process.exit(0)` или естественно, освободив все хендлы).
6. **Страховочный таймаут**: если не уложились — принудительно выйти (и `server.closeAllConnections()`).

```js
const server = http.createServer(app).listen(3000);
let shuttingDown = false;

async function shutdown(signal, code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "shutting down");

  const timer = setTimeout(() => { logger.error("forced exit"); process.exit(1); }, 10_000);
  timer.unref();                              // таймер не держит процесс живым

  server.close(async () => {                  // колбэк — когда закрылись все соединения
    try {
      await db.end();                         // пул БД
      await redis.quit();
      process.exit(code);
    } catch (err) {
      logger.error({ err });
      process.exit(1);
    }
  });
  server.closeIdleConnections();              // не ждём простаивающие keep-alive
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
```

Нюансы:

- Начиная с Node 19 `server.close()` сам закрывает простаивающие соединения, но явный вызов `closeIdleConnections()` не вредит и сохраняет совместимость со старыми версиями.
- `closeAllConnections()` — жёсткая мера для случая, когда время вышло; вызывается после `server.close()`.
- В Docker процесс должен быть **PID 1**, получающий сигнал: запуск через `npm start` или `sh -c` может не передать `SIGTERM` Node-процессу. Используйте `CMD ["node", "server.js"]` (exec-форма) или init (`tini`).
- WebSocket-соединения и long polling `server.close()` не завершит сам: их нужно закрывать вручную.
- Для Kubernetes: `readinessProbe` для вывода из балансировки, `terminationGracePeriodSeconds` больше вашего таймаута.

## Коды завершения

`0` — успех; `1` — необработанная ошибка; `process.exitCode = N` — задать код без немедленного завершения; `process.exit(N)` — завершить сразу (не дожидаясь открытых операций, поэтому используйте осознанно).

## Частые follow-up вопросы

**Почему нельзя в `uncaughtException` просто залогировать и продолжить?**
Состояние процесса неизвестно: могли остаться незакрытые ресурсы, частично применённые изменения. Продолжение ведёт к труднообъяснимым багам. Надёжнее перезапуск.

**Что будет с запросами в полёте при `process.exit()`?**
Они оборвутся. Поэтому нужен graceful shutdown.

**Чем `unhandledRejection` отличается от `uncaughtException`?**
Первое — отклонённый промис без обработчика; второе — исключение, дошедшее до event loop без перехвата. По умолчанию с Node 15 первое превращается во второе.

**Как узнать, откуда пришла ошибка в async-коде?**
Стек async-функций (async stack traces) сохраняется для цепочек `await`; добавляйте `cause` и контекст (идентификатор запроса), логируйте структурно.

**Нужно ли ловить ошибки в каждом обработчике?**
Нет: достаточно централизованного error handler. Ловите локально только там, где вы можете осмысленно отреагировать (ретрай, fallback, перевод в доменную ошибку).

## Типичные ошибки

- Пустой `catch {}`, проглатывающий ошибки.
- `throw "строка"` вместо `Error`.
- `uncaughtException` с «продолжением работы».
- Нет таймаута принудительного завершения в graceful shutdown.
- Отдача клиенту стека/SQL в тексте ошибки.
- Запуск через `npm start`/shell, из-за чего сигнал не доходит до процесса.
- Подписка на `SIGTERM` без закрытия HTTP-сервера и пула БД: процесс не завершается и убивается по `SIGKILL`.
