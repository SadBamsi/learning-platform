## Практика

1. Установи Node.js LTS с [nodejs.org](https://nodejs.org) и проверь: `node --version`.
2. Создай файл `hello.js`:
   ```js
   console.log("Hello, Node!", process.version);
   ```
   Запусти: `node hello.js`.
3. Предскажи порядок вывода, затем проверь запуском:
   ```js
   console.log("1");
   setTimeout(() => console.log("2 timeout"), 0);
   setImmediate(() => console.log("3 immediate"));
   Promise.resolve().then(() => console.log("4 promise"));
   process.nextTick(() => console.log("5 nextTick"));
   console.log("6");
   ```
   Объясни себе, почему порядок именно такой.
4. **Задача:** напиши скрипт, который выводит имя ОС, число CPU и объём свободной памяти в МБ (подсказка: модуль `node:os`).
5. **Задача:** прочитай файл `hello.js` двумя способами (sync и async) и выведи его длину в символах.
