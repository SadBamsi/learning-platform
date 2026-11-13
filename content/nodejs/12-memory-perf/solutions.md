## Решения

### Задание 1

```js
const mb = (n) => (n / 1024 / 1024).toFixed(1);
const show = (label) => {
  const m = process.memoryUsage();
  console.log(label.padEnd(8), `rss=${mb(m.rss)} heapUsed=${mb(m.heapUsed)} external=${mb(m.external)} arrayBuffers=${mb(m.arrayBuffers)}`);
};
show("start");
const arr = Array.from({ length: 1_000_000 }, (_, i) => ({ id: i }));
show("objects");
const buf = Buffer.alloc(200 * 1024 * 1024);
show("buffer");
```

После (б) растут `heapUsed` и `rss` (в моём запуске: `heapUsed` 3.5 → 41.8 МБ, `rss` 43 → 113 МБ): объекты лежат в куче V8. После (в) растут `external` и `arrayBuffers` (≈200 МБ), а `heapUsed` не меняется: содержимое `Buffer` хранится **вне** кучи V8, в куче лишь небольшой объект-обёртка. `rss` при этом почти не вырос (113 МБ), потому что страницы памяти под обнулённый буфер выделяются ОС лениво, пока в них не пишут. Вывод: `heapUsed` не показывает всей картины, смотрите `external`/`arrayBuffers`.

### Задание 2

```js
class LRUCache {
  #map = new Map();
  constructor(limit, ttlMs) { this.limit = limit; this.ttl = ttlMs; }
  get(key) {
    const e = this.#map.get(key);
    if (!e) return undefined;
    if (e.expires < Date.now()) { this.#map.delete(key); return undefined; }
    this.#map.delete(key); this.#map.set(key, e);          // освежаем позицию
    return e.value;
  }
  set(key, value) {
    this.#map.delete(key);
    this.#map.set(key, { value, expires: Date.now() + this.ttl });
    if (this.#map.size > this.limit) this.#map.delete(this.#map.keys().next().value); // вытесняем самый старый
  }
  get size() { return this.#map.size; }
}
```

Нагрузка (например, цикл `for i in $(seq 100000); do curl -s "localhost:3000/?q=$i" >/dev/null; done`) в версии с обычным `Map` даёт линейный рост `heapUsed`; с `LRUCache(1000, 60_000)` размер ограничен тысячей записей и график выходит на плато.

### Задание 3

Решение — класс из задания 2 (методы `get`/`set` выполняются за O(1)). Проверка:

```js
const c = new LRUCache(2, 1000);
c.set("a", 1); c.set("b", 2); c.get("a");   // a — самый свежий
c.set("c", 3);                              // вытесняется b
console.log(c.get("b"), c.get("a"), c.get("c")); // undefined 1 3
```

### Задание 4

Проблемы:

1. На каждый запрос добавляется слушатель `onTick` на долгоживущий `bus` и **не снимается**: растёт число слушателей (`MaxListenersExceededWarning`), каждый держит `big` на 1 МБ.
2. На каждый запрос создаётся `setInterval`, который **никогда не очищается**: таймеры накапливаются, постоянно эмитят события и удерживают замыкания.
3. `big` не нужен для ответа вообще.

Исправление: убрать лишнее и привязать ресурсы к жизненному циклу запроса.

```js
http.createServer((req, res) => {
  const onTick = () => {};
  bus.on("tick", onTick);
  res.on("close", () => bus.off("tick", onTick));   // снимаем при завершении запроса
  res.end("ok");
}).listen(3000);

const timer = setInterval(() => bus.emit("tick"), 1000);   // один общий таймер
timer.unref();
```

### Задание 5

Шаги: `node --heapsnapshot-signal=SIGUSR2 server.mjs`; `kill -USR2 <pid>` (первый снимок); нагрузка; `kill -USR2 <pid>` (второй). В DevTools откройте второй снимок, выберите **Comparison** с первым: колонки `# Delta` и `Size Delta` покажут рост. Для неограниченного кэша вы увидите растущие записи `Map`, строки ключей и значения; в нижней панели **Retainers** путь приведёт к объекту `cache` (корень — модульная область или замыкание). Именно эта ссылка и мешает GC.

### Задание 6

```js
function uniqueFast(arr) { return [...new Set(arr)]; }
console.time("fast"); uniqueFast(data); console.timeEnd("fast");
```

`node --cpu-prof file.mjs` создаст `CPU.*.cpuprofile`; в DevTools (вкладка Performance → Load profile) или в speedscope видно, что почти всё время занимает `Array.prototype.includes` внутри `uniqueSlow`. Версия со `Set` работает за O(n): на этих данных у меня получилось ≈112 мс против ≈3 мс, то есть десятки раз (числа зависят от машины), а в профиле почти всё время приходится на `uniqueSlow`.

### Задание 7

Пример ответа:

«Сначала подтверждаю, что это именно утечка, а не рост из-за нагрузки или кэша: смотрю график `heapUsed` после GC и `rss` за несколько дней, сопоставляю с трафиком и релизами. Если растёт `heapUsed`, снимаю heap snapshot с работающего инстанса (сигнал `SIGUSR2` с `--heapsnapshot-signal` или `--inspect` на одном канареечном поде), делаю два-три снимка с нагрузкой между ними и сравниваю в DevTools: смотрю, какие конструкторы растут, и в Retainers — кто их удерживает. Типичные виновники: неограниченные кэши, слушатели без отписки, таймеры, замыкания, накопление данных запросов. Если растёт `rss` без роста кучи — смотрю `external`/`arrayBuffers`, буферы, нативные аддоны. Исправляю (LRU/TTL, `off`/`clearInterval`, `WeakMap`), выкатываю и подтверждаю по метрикам. Параллельно ставлю алерт на рост памяти и лимит `--max-old-space-size` в согласии с лимитом контейнера, чтобы падение было предсказуемым. Увеличение лимита без диагностики — только временная мера».
