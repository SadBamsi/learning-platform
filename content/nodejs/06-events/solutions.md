## Решения

### Задание 1

```
start
0
1
once
true
0
1
true
false
end
```

`prependListener` ставит слушателя в начало; `once` срабатывает один раз; `emit` возвращает `true`, если были слушатели. Всё выполняется синхронно: «start» и «end» обрамляют вывод слушателей.

### Задание 2

Оба вызова бросят исключение из `emit`: первый — исходный `Error("boom")`; второй — `ERR_UNHANDLED_ERROR`, так как переданное значение не `Error`. Без `try/catch` процесс завершится. Исправление:

```js
e.on("error", (err) => console.error("handled:", err.message));
```

### Задание 3

```js
const e = new EventEmitter();
for (let i = 0; i < 11; i++) e.on("x", () => {});
// (node) MaxListenersExceededWarning: Possible EventEmitter memory leak detected. 11 x listeners added...
```

Безопасная версия:

```js
function handleRequest(config, res) {
  const onChange = (v) => res.write(`changed: ${v}\n`);
  config.on("change", onChange);
  res.on("close", () => config.off("change", onChange)); // снимаем при завершении запроса
}
```

### Задание 4

```js
class Emitter {
  #handlers = new Map();

  on(evt, fn) {
    if (!this.#handlers.has(evt)) this.#handlers.set(evt, []);
    this.#handlers.get(evt).push(fn);
    return this;
  }
  off(evt, fn) {
    const list = this.#handlers.get(evt);
    if (!list) return this;
    this.#handlers.set(evt, list.filter((h) => h !== fn && h.original !== fn));
    return this;
  }
  once(evt, fn) {
    const wrapper = (...args) => {
      this.off(evt, wrapper);
      fn.apply(this, args);
    };
    wrapper.original = fn;
    return this.on(evt, wrapper);
  }
  emit(evt, ...args) {
    const list = this.#handlers.get(evt);
    if (!list || list.length === 0) return false;
    for (const fn of [...list]) fn.apply(this, args); // копия — безопасно при off() внутри слушателя
    return true;
  }
}
```

### Задание 5

```js
import { EventEmitter } from "node:events";

class Timer extends EventEmitter {
  constructor(ms, limit) {
    super();
    let n = 0;
    this.id = setInterval(() => {
      this.emit("tick", ++n);
      if (n >= limit) { clearInterval(this.id); this.emit("done"); }
    }, ms);
  }
}

const t = new Timer(100, 3);
t.on("tick", (n) => console.log("tick", n));
t.on("done", () => console.log("done"));
```

Здесь подписка происходит сразу после конструктора, а первый `emit` — только через 100 мс, поэтому всё работает. Если бы `emit` делался прямо в конструкторе, подписаться не успели бы.

### Задание 6

```js
import { EventEmitter, once, on } from "node:events";

const e = new EventEmitter();

// (1)
setTimeout(() => e.emit("ready", 42), 100);
const [v] = await once(e, "ready");
console.log("ready:", v);

// (2)
const ac = new AbortController();
e.once("close", () => ac.abort());
setTimeout(() => e.emit("message", "a"), 10);
setTimeout(() => e.emit("message", "b"), 20);
setTimeout(() => e.emit("close"), 30);

try {
  for await (const [msg] of on(e, "message", { signal: ac.signal })) {
    console.log("msg:", msg);
  }
} catch (err) {
  if (err.name !== "AbortError") throw err;
}
console.log("finished");
```

### Задание 7

`emit` вернёт управление сразу, напечатается `after emit`, а `async`-слушатель вернёт отклонённый промис, который никто не обработал: unhandled rejection, по умолчанию процесс завершится. Способы:

```js
// 1) try/catch внутри слушателя
e.on("x", async () => { try { await work(); } catch (err) { log(err); } });

// 2) captureRejections: ошибки уйдут в событие 'error'
const e2 = new EventEmitter({ captureRejections: true });
e2.on("error", (err) => console.error("captured:", err.message));
e2.on("x", async () => { throw new Error("async boom"); });
e2.emit("x");
```
