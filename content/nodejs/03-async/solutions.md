## Решения

### Задание 1

Вывод: `a e h c f d b g`.

- Синхронно: `a`, `e` (до первого `await`), `h`.
- Микрозадачи: `c` (первый `.then`), `f` (продолжение после `await Promise.resolve()`); затем `d` (второй `.then` поставлен после выполнения `c`).
- Далее `await new Promise(setTimeout)`: ждём таймеры. Сначала сработает `b` (поставлен раньше), затем `r()`, после которого печатается `g`.

### Задание 2

```js
console.time("par");
const [a, b, c] = await Promise.all([delay(300, "A"), delay(300, "B"), delay(300, "C")]);
console.timeEnd("par"); // ≈ 300 мс вместо ≈ 900 мс
```

### Задание 3

- `Promise.all` → отклоняется с `Error("x")` (fail-fast), остальные операции продолжают выполняться, но результат игнорируется.
- `Promise.allSettled` → `[ {status:"fulfilled",value:1}, {status:"rejected",reason:Error("x")}, {status:"fulfilled",value:3} ]`.
- `Promise.race` → отклоняется с `Error("x")`: он завершается первым (уже отклонён на момент вызова).
- `Promise.any` → выполняется значением `3` (первый успех — тот, что с `delay(50)`). Если бы отклонились все, был бы `AggregateError`.

### Задание 4

```js
function promiseAll(iterable) {
  return new Promise((resolve, reject) => {
    const items = [...iterable];
    const results = new Array(items.length);
    let pending = items.length;
    if (pending === 0) return resolve(results);

    items.forEach((item, i) => {
      Promise.resolve(item).then((value) => {
        results[i] = value;           // сохраняем по индексу, а не push
        if (--pending === 0) resolve(results);
      }, reject);                     // первая ошибка отклоняет всё
    });
  });
}
```

Ключевые моменты: `Promise.resolve(item)` для не-промисов, запись по индексу (сохраняет порядок), счётчик оставшихся, пустой массив.

### Задание 5

```js
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;

  async function worker() {
    while (true) {
      const i = next++;                 // забираем индекс синхронно — гонок нет
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

console.time("t");
await mapLimit(Array.from({ length: 10 }, (_, i) => i), 3, (i) => delay(100, i));
console.timeEnd("t"); // ≈ 400 мс: 4 «волны» по 3, 3, 3, 1
```

Гонок нет, потому что JS однопоточен: `next++` выполняется атомарно между `await`.

### Задание 6

```js
import { setTimeout as sleep } from "node:timers/promises";

async function retry(fn, { retries = 3, baseDelay = 100, timeout = 1000 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn(AbortSignal.timeout(timeout));
    } catch (err) {
      lastError = err;
      if (attempt < retries) await sleep(baseDelay * 2 ** attempt);
    }
  }
  throw lastError;
}

// использование: fn принимает signal и пробрасывает его в fetch
await retry((signal) => fetch("https://example.com", { signal }));
```

В продакшене добавляют **jitter** (случайную добавку к паузе), чтобы множество клиентов не повторяли запросы одновременно, и повторяют только *идемпотентные* запросы и «временные» ошибки (5xx, сеть, 429).

### Задание 7

1. `forEach` не ждёт `async`-колбэки, поэтому `"all removed"` напечатается до удаления, а ошибки станут unhandled rejections. Исправление: `await Promise.all(ids.map(remove))` или цикл `for…of` с `await`.
2. `return db.find(id)` без `await` внутри `try`: отклонение промиса не будет поймано этим `catch`. Исправление: `return await db.find(id)`.
3. `async` executor — антипаттерн: если `readConfig()` или `JSON.parse` бросят, промис `p` **никогда не отклонится** (останется pending), а ошибка превратится в unhandled rejection. Исправление: `const p = readConfig().then(JSON.parse)` либо `async function` без `new Promise`.
