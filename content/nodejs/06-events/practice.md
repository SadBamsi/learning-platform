## Задания на закрепление

### Задание 1. Порядок и синхронность

Что выведет код? Предскажите, затем запустите.

```js
import { EventEmitter } from "node:events";
const e = new EventEmitter();

e.on("go", () => console.log("1"));
e.prependListener("go", () => console.log("0"));
e.once("go", () => console.log("once"));

console.log("start");
console.log(e.emit("go"));
console.log(e.emit("go"));
console.log(e.emit("nope"));
console.log("end");
```

### Задание 2. Событие `error`

Что произойдёт при каждом вызове? Как исправить, чтобы процесс не падал?

```js
const e = new EventEmitter();
e.emit("error", new Error("boom"));
e.emit("error", "just a string");
```

### Задание 3. Утечка слушателей

Воспроизведите `MaxListenersExceededWarning`: подпишитесь в цикле 11 раз на одно событие. Затем напишите безопасную версию «подписаться на событие только на время жизни запроса» (с отпиской), не повышая лимит.

### Задание 4. Свой EventEmitter

Реализуйте класс `Emitter` с методами `on`, `off`, `once`, `emit` (и цепочкой вызовов). Требования: порядок вызова = порядок подписки; `emit` возвращает `true/false`; `off` корректно работает для `once`-слушателя, ещё не сработавшего; отписка внутри слушателя во время `emit` не ломает итерацию.

### Задание 5. Наследование

Создайте класс `Timer extends EventEmitter`, который каждые N мс эмитит `tick` с номером тика, после M тиков эмитит `done` и останавливается. Подпишитесь на оба события.

### Задание 6. События как промисы

Используя `events.once` и `events.on`: (1) дождитесь события `ready`, которое эмитится через 100 мс; (2) обработайте поток событий `message` циклом `for await`, завершив цикл по событию `close` (подсказка: `AbortController`).

### Задание 7. Асинхронные слушатели

Что произойдёт при следующем коде? Как поймать ошибку?

```js
const e = new EventEmitter();
e.on("x", async () => { throw new Error("async boom"); });
e.emit("x");
console.log("after emit");
```
