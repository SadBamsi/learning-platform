## Задания на закрепление

Файлы сохраняйте как `.mjs`.

### Задание 1. Порядок выполнения

Предскажите вывод, затем проверьте запуском:

```js
console.log("a");
setTimeout(() => console.log("b"), 0);
Promise.resolve()
  .then(() => console.log("c"))
  .then(() => console.log("d"));
(async () => {
  console.log("e");
  await Promise.resolve();
  console.log("f");
  await new Promise((r) => setTimeout(r, 0));
  console.log("g");
})();
console.log("h");
```

### Задание 2. Последовательно → параллельно

Есть функция `delay(ms, value)`, возвращающая промис, который выполняется через `ms` с `value`. Замерьте время и ускорьте код с трёх до одной «волны» ожидания:

```js
const delay = (ms, v) => new Promise((r) => setTimeout(() => r(v), ms));

console.time("seq");
const a = await delay(300, "A");
const b = await delay(300, "B");
const c = await delay(300, "C");
console.timeEnd("seq");
```

### Задание 3. Комбинаторы

Для массива промисов `[delay(100, 1), Promise.reject(new Error("x")), delay(50, 3)]` определите (письменно, затем проверьте), что вернут/как завершатся: `Promise.all`, `Promise.allSettled`, `Promise.race`, `Promise.any`.

### Задание 4. Реализуйте `promiseAll`

Напишите свою функцию `promiseAll(iterable)`, повторяющую поведение `Promise.all`: возвращает промис с массивом результатов **в исходном порядке**, отклоняется при первой ошибке, принимает не-промисы в массиве, для пустого массива сразу выполняется с `[]`.

### Задание 5. Ограничение конкурентности

Напишите `mapLimit(items, limit, asyncFn)`, который обрабатывает элементы, выполняя одновременно не более `limit` вызовов `asyncFn`, и возвращает массив результатов в исходном порядке. Проверьте на 10 задачах по 100 мс с `limit = 3` (общее время ≈ 400 мс).

### Задание 6. Retry с экспоненциальной паузой и таймаутом

Реализуйте `retry(fn, { retries = 3, baseDelay = 100, timeout = 1000 })`: если `fn` упала или не уложилась в таймаут, повторить, увеличивая паузу вдвое (100, 200, 400 мс…). После исчерпания попыток — бросить последнюю ошибку. Используйте `AbortSignal` для отмены попытки по таймауту.

### Задание 7. Найдите ошибки

Что не так в каждом фрагменте? Исправьте.

```js
// 1
const ids = [1, 2, 3];
ids.forEach(async (id) => { await remove(id); });
console.log("all removed");

// 2
async function getUser(id) {
  try {
    return db.find(id);
  } catch (e) {
    return null;
  }
}

// 3
const p = new Promise(async (resolve) => {
  const data = await readConfig();
  resolve(JSON.parse(data));
});
```
