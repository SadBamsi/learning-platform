## Задания на закрепление

Файлы — `.mjs`. Для чтения памяти используйте `process.memoryUsage()`.

### Задание 1. Куда ушла память

Выведите `rss`, `heapUsed`, `external`, `arrayBuffers` (в МБ) в три момента: (а) в начале; (б) после создания массива из 1 млн объектов `{ id: i }`; (в) после `Buffer.alloc(200 * 1024 * 1024)`. Какие показатели выросли в каждом случае и почему?

### Задание 2. Утечка в кэше

Сервер на `node:http` кэширует ответы в `Map`, ключ — URL с произвольным `?q=`. Нагрузите его сериями запросов с уникальными `q` и покажите рост `heapUsed`. Затем реализуйте ограничение: LRU на 1000 записей и TTL 60 секунд. Убедитесь, что память выходит на плато.

### Задание 3. LRU-кэш

Реализуйте класс `LRUCache(limit)` с методами `get(key)`, `set(key, value)` за **O(1)**, используя `Map` (подсказка: `Map` хранит порядок вставки; чтобы «освежить» ключ, удалите и вставьте заново; самый старый — первый ключ `map.keys().next().value`).

### Задание 4. Утечка слушателей и таймеров

Найдите утечки и исправьте:

```js
const bus = new EventEmitter();
setInterval(() => console.log(process.memoryUsage().heapUsed), 5000);

http.createServer((req, res) => {
  const big = Buffer.alloc(1024 * 1024);
  const onTick = () => big.length;
  bus.on("tick", onTick);
  const t = setInterval(() => bus.emit("tick"), 1000);
  res.end("ok");
}).listen(3000);
```

### Задание 5. Heap snapshot

Запустите программу из задания 2 с `--heapsnapshot-signal=SIGUSR2`, нагрузите её, отправьте `kill -USR2 <pid>` дважды (до и после нагрузки). Откройте файлы `.heapsnapshot` в Chrome DevTools → Memory → Load и найдите, какой объект/конструктор растёт и кто его удерживает (Retainers).

### Задание 6. CPU-профиль

Дана функция:

```js
function uniqueSlow(arr) {
  const out = [];
  for (const x of arr) if (!out.includes(x)) out.push(x);   // O(n²)
  return out;
}
const data = Array.from({ length: 50_000 }, () => Math.floor(Math.random() * 20_000));
console.time("slow"); uniqueSlow(data); console.timeEnd("slow");
```

Снимите профиль (`node --cpu-prof file.mjs`), найдите горячую функцию, перепишите за O(n) (подсказка: `Set`) и сравните время.

### Задание 7. Ответ для интервью

За 2 минуты расскажите: *«Сервис в продакшене постепенно потребляет всё больше памяти и в итоге перезапускается по OOM. Ваши действия?»*
