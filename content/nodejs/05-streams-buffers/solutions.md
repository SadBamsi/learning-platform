## Решения

### Задание 1

```js
import { readFile, writeFile } from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";

const mb = () => Math.round(process.memoryUsage().rss / 1024 / 1024);

if (process.argv[2] === "buffer") {
  await writeFile("copy.txt", await readFile("big.txt"));
} else {
  await pipeline(createReadStream("big.txt"), createWriteStream("copy.txt"));
}
console.log(process.argv[2] ?? "stream", "rss MB:", mb());
```

Запуск: `node copy.mjs buffer` и `node copy.mjs`. Вариант с `readFile` держит в памяти **весь файл** (у меня на файле ≈190 МБ: rss ≈237 МБ против ≈73 МБ у стрима), стрим держит в памяти только небольшие чанки независимо от размера файла. Точные числа зависят от машины.

### Задание 2

```js
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createReadStream, createWriteStream } from "node:fs";

// 1) Класс Transform
const upper = new Transform({
  transform(chunk, _enc, cb) { cb(null, chunk.toString().toUpperCase()); },
});
await pipeline(createReadStream("big.txt"), upper, createWriteStream("upper1.txt"));

// 2) async-генератор
await pipeline(
  createReadStream("big.txt", "utf8"),
  async function* (source) { for await (const chunk of source) yield chunk.toUpperCase(); },
  createWriteStream("upper2.txt")
);
```

В первом варианте `chunk.toString()` может разорвать многобайтовый символ на границе чанков (для ASCII-файла безопасно). Для произвольного текста задавайте кодировку на Readable (`createReadStream(path, "utf8")`) — как во втором варианте.

### Задание 3

```js
import { createReadStream } from "node:fs";
import readline from "node:readline";

async function countLines(path) {
  const rl = readline.createInterface({ input: createReadStream(path), crlfDelay: Infinity });
  let n = 0;
  for await (const _ of rl) n++;
  return n;
}

// Быстрее: считаем байты \n в чанках, без декодирования строк
async function countLinesFast(path) {
  let n = 0;
  for await (const chunk of createReadStream(path)) {
    let i = -1;
    while ((i = chunk.indexOf(10, i + 1)) !== -1) n++;
  }
  return n;
}
```

Второй способ быстрее: нет декодирования UTF-8 и создания миллионов строк. Минус: считает `\n`, а не «логические» строки (последняя строка без перевода не учтена).

### Задание 4

```js
import { createWriteStream } from "node:fs";
import { once } from "node:events";

const ws = createWriteStream("out.txt");
const mb = () => Math.round(process.memoryUsage().rss / 1024 / 1024);

for (let i = 0; i < 1_000_000; i++) {
  const ok = ws.write(`line ${i}\n`);
  // версия «с уважением»: раскомментируйте
  // if (!ok) await once(ws, "drain");
}
ws.end();
console.log("rss MB:", mb());
```

Без `drain` (у меня пик rss ≈359 МБ против ≈111 МБ с `drain`) цикл выполняется синхронно и успевает положить во внутренний буфер миллион строк, прежде чем event loop сможет начать запись на диск. rss растёт. С `drain` буфер не превышает `highWaterMark`.

### Задание 5

1. `"Привет".length` → **6** (символов), `Buffer.from("Привет").length` → **12** (байтов): кириллица в UTF-8 занимает 2 байта.
2. `Buffer.from("hello").toString("hex")` → `68656c6c6f`; `.toString("base64")` → `aGVsbG8=`. Обратно: `Buffer.from("68656c6c6f", "hex").toString()` и `Buffer.from("aGVsbG8=", "base64").toString()`.
3. Значения приводятся по модулю 256: `256 → 0`, `-1 → 255 (ff)`, `65 → 41`. Результат: `00ff41`.
4. `alloc` заполняет нулями (безопасно); `allocUnsafe` не очищает память — быстрее, но буфер может содержать фрагменты старых данных (в том числе чувствительных). Используйте только если сразу полностью перезапишете содержимое.

### Задание 6

```js
import { StringDecoder } from "node:string_decoder";

const bytes = Buffer.from("я");          // 2 байта: d1 8f
const [a, b] = [bytes.subarray(0, 1), bytes.subarray(1)];

console.log(a.toString() + b.toString()); // "��" — потеряли символ

const d = new StringDecoder("utf8");
console.log(d.write(a) + d.write(b));     // "я" — декодер дождался второго байта
```

### Задание 7

```js
import http from "node:http";
import { createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";

http.createServer(async (req, res) => {
  if (req.url !== "/download") { res.statusCode = 404; return res.end(); }
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  try {
    await pipeline(createReadStream("big.txt"), res);
  } catch (err) {
    // ERR_STREAM_PREMATURE_CLOSE при обрыве клиентом — штатная ситуация
    if (err.code !== "ERR_STREAM_PREMATURE_CLOSE") console.error(err);
  }
}).listen(3000);
```

При обрыве `curl` `pipeline` получит ошибку закрытия `res` и **уничтожит** `createReadStream`, файловый дескриптор будет освобождён. С голым `createReadStream(...).pipe(res)` при закрытии сокета читающий стрим не уничтожается автоматически, и дескриптор остаётся открытым (я проверил на Node 24: событие `close` читающего стрима не наступило даже через секунду). На тысячах обрывов получается утечка.
