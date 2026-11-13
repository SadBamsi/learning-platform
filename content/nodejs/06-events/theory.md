> **Ответ за 30 секунд.** `EventEmitter` из `node:events` — реализация паттерна «издатель–подписчик»: `on(event, fn)` подписывает, `emit(event, ...args)` вызывает всех слушателей, `once` — одноразовая подписка, `off` — отписка. Важнейшие факты: `emit` вызывает слушателей **синхронно**, в порядке подписки; событие **`'error'` без слушателя бросает исключение** и может уронить процесс; на одно событие по умолчанию рекомендуется не больше 10 слушателей (иначе `MaxListenersExceededWarning` — признак утечки). На EventEmitter построены `http`, `net`, `stream`, `process`, `fs.watch` и т. д.

## Что именно спрашивают

- «Что такое EventEmitter? Где используется в Node.js?»
- «Синхронно или асинхронно вызываются обработчики?»
- «Что будет, если `emit('error')` без обработчика?»
- «Как возникает утечка памяти с EventEmitter?»
- «Реализуйте свой EventEmitter» (одна из самых частых live-задач)

## Основы

```js
import { EventEmitter } from "node:events";

const bus = new EventEmitter();

bus.on("order", (id, total) => console.log("A:", id, total));
bus.once("order", () => console.log("B: только один раз"));

console.log(bus.emit("order", 7, 100)); // true  — были слушатели
console.log(bus.emit("order", 8, 200)); // true; «B» уже не вызовется
console.log(bus.emit("nothing"));       // false — слушателей нет
```

Основные методы: `on`/`addListener`, `once`, `off`/`removeListener`, `emit`, `prependListener`, `removeAllListeners`, `listenerCount`, `setMaxListeners`.

## Ключевые свойства

### 1. `emit` синхронный

Слушатели выполняются **сразу, друг за другом, в порядке подписки**, до возврата из `emit`:

```js
bus.on("x", () => console.log("1"));
bus.on("x", () => console.log("2"));
console.log("до");
bus.emit("x");     // печатает 1, 2
console.log("после"); // порядок: до, 1, 2, после
```

Следствия: тяжёлый слушатель блокирует эмиттера (и event loop); исключение в слушателе «вылетает» из `emit` и не даёт сработать следующим слушателям. Асинхронность добавляют явно: `setImmediate`/`queueMicrotask` внутри слушателя или эмиттера.

Поэтому в API, где событие может сработать сразу после создания объекта, эмитят в следующем тике (`process.nextTick(() => this.emit("ready"))`): иначе подписаться не успеют.

### 2. Событие `'error'`

Если эмитится `'error'` и слушателей нет, Node **бросает** переданный `Error` (а если аргумент не `Error`, оборачивает в `ERR_UNHANDLED_ERROR`). Необработанное исключение завершает процесс. Поэтому любой эмиттер, который может падать (сокет, стрим, дочерний процесс), нужно снабжать `on("error", ...)`.

### 3. Утечки слушателей

Если подписываться в цикле/на каждый запрос и не отписываться, слушатели копятся, а вместе с ними замыкания и всё, что они удерживают.

```js
// Плохо: на каждый запрос +1 слушатель на долгоживущем объекте
app.get("/", (req, res) => {
  config.on("change", () => res.send("..."));  // никогда не снимается
});
```

При превышении лимита (по умолчанию 10 слушателей на событие) Node выводит `MaxListenersExceededWarning: Possible EventEmitter memory leak detected`. Лимит меняется `setMaxListeners(n)`, но предупреждение чаще сигнализирует о реальной ошибке, а не о необходимости поднять лимит.

Лечение: отписываться (`off`), использовать `once`, использовать `AbortSignal`: `addEventListener(evt, fn, { signal })` у `EventTarget` и `events.once(emitter, evt, { signal })`, привязывать время жизни слушателя к времени жизни объекта.

### 4. `this` и стрелочные функции

В обычной функции-слушателе `this` — сам эмиттер; в стрелочной — лексический `this`. Сняться можно только по **той же ссылке** на функцию:

```js
const handler = () => {};
bus.on("x", handler);
bus.off("x", handler);          // ок
bus.off("x", () => {});         // не сработает: другая функция
```

### 5. Асинхронные слушатели

Эмиттер **не ждёт** `async`-слушателей, а их ошибки превращаются в unhandled rejection. Для маршрутизации таких ошибок в `'error'` служит опция `captureRejections: true` у `EventEmitter`.

## Промисы и итераторы событий

```js
import { once, on } from "node:events";

const [value] = await once(bus, "ready");     // ждём событие как промис
// если до этого сработает 'error', промис будет отклонён

for await (const [msg] of on(bus, "message")) {  // поток событий как async-итератор
  console.log(msg);
}
```

## EventEmitter и другие модели

| Подход | Особенности |
|---|---|
| **EventEmitter** | синхронный, в пределах процесса, нет гарантий доставки/порядка между процессами |
| **EventTarget** (Web-стандарт, есть и в Node) | то же для DOM-подобного API, `AbortSignal` — его наследник |
| **Брокер сообщений** (Kafka, RabbitMQ, Redis Pub/Sub) | между процессами и сервисами, асинхронный, с очередями и ретраями |

На собеседовании важно отличать: EventEmitter — это про **связность внутри процесса**, а не масштабируемая шина событий между сервисами.

## Реализация своего EventEmitter

```js
class Emitter {
  #handlers = new Map();

  on(evt, fn) {
    (this.#handlers.get(evt) ?? this.#handlers.set(evt, []).get(evt)).push(fn);
    return this;
  }
  off(evt, fn) {
    const list = this.#handlers.get(evt);
    if (list) this.#handlers.set(evt, list.filter((h) => h !== fn && h.original !== fn));
    return this;
  }
  once(evt, fn) {
    const wrapper = (...args) => { this.off(evt, wrapper); fn(...args); };
    wrapper.original = fn; // чтобы работало off(evt, fn) до срабатывания
    return this.on(evt, wrapper);
  }
  emit(evt, ...args) {
    const list = this.#handlers.get(evt);
    if (!list?.length) return false;
    for (const fn of [...list]) fn(...args); // копия: слушатели могут отписываться во время emit
    return true;
  }
}
```

Что проверяют: порядок вызова, `once`, отписка во время `emit` (потому копия массива), возвращаемое значение `emit`, `this`/chaining, поведение при отсутствии слушателей.

## Частые follow-up вопросы

**Как `http.Server` использует EventEmitter?**
Он наследуется от `EventEmitter`: `server.on("request", handler)`, `"connection"`, `"close"`, `"error"`. Колбэк `createServer(handler)` — просто подписка на `request`.

**Что будет, если слушатель бросит исключение?**
Оно пробросится из `emit` синхронно; остальные слушатели этого вызова не выполнятся.

**Почему `emit` внутри конструктора обычно «теряется»?**
Подписаться ещё не успели: конструктор выполняется синхронно до возврата экземпляра. Эмитят отложенно (`process.nextTick`).

**EventEmitter против Observable (RxJS)?**
Observable добавляет операторы, отмену, обработку ошибок и завершение потока; EventEmitter минимален и без встроенных операторов.

## Типичные ошибки

- Нет обработчика `'error'`.
- Подписка внутри запроса/цикла без отписки.
- Ожидание, что `emit` асинхронный или что эмиттер ждёт `async`-слушателей.
- Отписка анонимной функцией.
- Использование EventEmitter как межсервисной шины.
