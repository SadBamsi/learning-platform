## Задания на закрепление

Файлы сохраняйте как `.mjs` или `.cjs` (где указано) и запускайте через `node`. **Сначала предскажите вывод письменно, потом запускайте.**

### Задание 1. Классика

Предскажите порядок вывода для CommonJS (`order.cjs`) и затем для ESM (`order.mjs`). Различается ли он? Почему?

```js
console.log("A");
setTimeout(() => console.log("B"), 0);
setImmediate(() => console.log("C"));
Promise.resolve().then(() => console.log("D"));
process.nextTick(() => console.log("E"));
(async () => {
  console.log("F");
  await null;
  console.log("G");
})();
console.log("H");
```

### Задание 2. Внутри I/O

Что выведется первым и почему — `timeout` или `immediate`? Гарантирован ли порядок?

```js
import fs from "node:fs";
fs.readFile(import.meta.filename, () => {
  setTimeout(() => console.log("timeout"), 0);
  setImmediate(() => console.log("immediate"));
  process.nextTick(() => console.log("tick"));
});
```

### Задание 3. Голодание

Запустите код и объясните, почему `"timer fired"` не выводится. Затем исправьте так, чтобы таймер срабатывал, а «работа» продолжалась.

```js
setTimeout(() => console.log("timer fired"), 10);

let n = 0;
function work() {
  n++;
  if (n < 1e6) process.nextTick(work);
}
work();
console.log("work scheduled");
```

### Задание 4. Измеряем лаг цикла

С помощью `perf_hooks.monitorEventLoopDelay()` напишите мини-мониторинг: каждую секунду выводите среднюю и максимальную задержку цикла в миллисекундах. Затем добавьте в программу синхронный блокирующий вызов на 500 мс и убедитесь, что лаг вырос.

### Задание 5. Не блокируй цикл

Функция ниже считает сумму до 500 млн и блокирует цикл на пару секунд. Перепишите её в `async`-версию, которая отдаёт управление циклу каждые N итераций, чтобы параллельный `setInterval(() => console.log("tick"), 100)` продолжал срабатывать.

```js
function heavy() {
  let s = 0;
  for (let i = 0; i < 5e8; i++) s += i;
  return s;
}
```

### Задание 6. Ответ для интервью

Объясните вслух за 1–2 минуты: *«Как Node.js понимает, какой колбэк выполнить следующим?»* В ответе: фазы, очереди, микрозадачи, роль poll-фазы.
