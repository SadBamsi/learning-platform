## Решения

### Задание 1

```js
// server.mjs
import http from "node:http";
import { Worker } from "node:worker_threads";

const fib = (n) => (n < 2 ? n : fib(n - 1) + fib(n - 2));

function fibInWorker(n) {
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL("./fib-worker.mjs", import.meta.url), { workerData: n });
    w.once("message", resolve);
    w.once("error", reject);
  });
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/ping") return res.end("pong\n");
  if (url.pathname === "/fib") {
    const n = Number(url.searchParams.get("n") ?? 35);
    // Синхронный вариант (блокирует): const result = fib(n);
    const result = await fibInWorker(n);
    return res.end(`${result}\n`);
  }
  res.statusCode = 404; res.end();
}).listen(3000);
```

```js
// fib-worker.mjs
import { parentPort, workerData } from "node:worker_threads";
const fib = (n) => (n < 2 ? n : fib(n - 1) + fib(n - 2));
parentPort.postMessage(fib(workerData));
```

В синхронном варианте `curl /ping` во время `/fib?n=42` ждёт окончания вычисления; с воркером отвечает сразу.

### Задание 2

```js
import { Worker } from "node:worker_threads";

class Pool {
  #idle = []; #queue = [];
  constructor(file, size) {
    for (let i = 0; i < size; i++) this.#idle.push(new Worker(file));
  }
  run(data) {
    return new Promise((resolve, reject) => {
      this.#queue.push({ data, resolve, reject });
      this.#next();
    });
  }
  #next() {
    if (!this.#idle.length || !this.#queue.length) return;
    const worker = this.#idle.pop();
    const { data, resolve, reject } = this.#queue.shift();
    const done = (fn) => (v) => {
      worker.off("message", onMsg); worker.off("error", onErr);
      this.#idle.push(worker);
      fn(v);
      this.#next();
    };
    const onMsg = done(resolve), onErr = done(reject);
    worker.once("message", onMsg);
    worker.once("error", onErr);
    worker.postMessage(data);
  }
  async close() { await Promise.all([...this.#idle].map((w) => w.terminate())); }
}
```

Воркер: `parentPort.on("message", (n) => parentPort.postMessage(fib(n)))`. Пул экономит время старта воркера (десятки мс и отдельная куча) и ограничивает параллелизм числом ядер: запуск 1000 воркеров одновременно только исчерпает память и CPU. В продакшене используют готовый `piscina`.

### Задание 3

```js
// main.mjs
import { Worker } from "node:worker_threads";
const mode = process.argv[2] ?? "plain";
const sab = new SharedArrayBuffer(4);
const view = new Int32Array(sab);
const workers = Array.from({ length: 4 }, () => new Worker(new URL("./inc.mjs", import.meta.url), { workerData: { sab, mode } }));
await Promise.all(workers.map((w) => new Promise((r) => w.once("exit", r))));
console.log(mode, Atomics.load(view, 0)); // ожидаем 400000

// inc.mjs
import { workerData } from "node:worker_threads";
const view = new Int32Array(workerData.sab);
for (let i = 0; i < 100_000; i++) {
  if (workerData.mode === "atomic") Atomics.add(view, 0, 1);
  else view[0]++;
}
```

Обычный `view[0]++` — это чтение, увеличение и запись; потоки «перетирают» друг друга (гонка данных), итог **меньше** 400 000 (конкретное число каждый раз разное). `Atomics.add` выполняет операцию атомарно: итог ровно 400 000.

### Задание 4

```js
import cluster from "node:cluster";
import http from "node:http";
import os from "node:os";

if (cluster.isPrimary) {
  for (let i = 0; i < os.availableParallelism(); i++) cluster.fork();
  cluster.on("exit", (w, code) => {
    console.log(`worker ${w.process.pid} exit ${code}; respawn`);
    cluster.fork();
  });
} else {
  http.createServer((req, res) => {
    if (req.url === "/crash") process.exit(1);
    res.end(`pid ${process.pid}\n`);
  }).listen(3000);
}
```

`for i in $(seq 20); do curl -s localhost:3000; done` покажет разные PID: каждое новое соединение отдаётся очередному воркеру (round-robin). Клиент с keep-alive (например, `fetch`) переиспользует соединение, поэтому PID у него может повторяться, и это нормально. После `/crash` в логе primary появится перезапуск воркера.

### Задание 5

Атака: `host=8.8.8.8;rm -rf ~` или `host=$(cat /etc/passwd)`. Строка передаётся в shell, поэтому `;`, `&&`, `$()` и пр. выполняются как команды (**command injection**).

```js
import { execFile } from "node:child_process";
import net from "node:net";

app.get("/ping", (req, res) => {
  const host = String(req.query.host ?? "");
  if (!net.isIP(host)) return res.status(400).send("invalid host");  // валидация входа
  execFile("ping", ["-c", "1", host], { timeout: 5000 }, (err, out) => {  // без shell, аргументы отдельно
    res.send(out);
  });
});
```

Ключевые меры: не использовать shell, передавать аргументы массивом, валидировать вход (allow-list), ставить таймаут.

### Задание 6

Проблемы:

- `Map` с корзинами живёт в памяти **одного** пода: следующий запрос уйдёт на другой под — корзины не будет. При перезапуске пода данные пропадут.
- `./uploads` — локальный диск пода: файл, загруженный через один под, недоступен другим; пропадает при пересоздании пода.

Исправления: хранить корзины в Redis (или БД) с TTL; файлы — в объектном хранилище (S3-совместимом) с отдачей по URL/CDN; конфиги — через переменные окружения; фоновые задачи — через очередь.

### Задание 7

Пример ответа:

«Сначала измеряю, а не угадываю. Смотрю метрики: загрузка CPU по инстансам, event loop lag (`monitorEventLoopDelay`), p95/p99 latency. Если lag растёт и CPU близок к 100% на одном ядре — упираемся в главный поток. Снимаю CPU-профиль (`--cpu-prof` или Chrome DevTools / clinic flame) и ищу горячие места: JSON-обработка больших объёмов, синхронная криптография, регулярки, сериализация. Лечение по приоритету: оптимизировать алгоритм и убрать синхронные вызовы; кэшировать результаты; тяжёлые вычисления вынести в пул `worker_threads` или очередь с отдельными воркерами; запустить несколько инстансов (контейнеры/PM2) за балансировщиком и сделать сервис stateless. После этого — нагрузочный тест, чтобы подтвердить эффект».
