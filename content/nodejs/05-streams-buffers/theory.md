> **Ответ за 30 секунд.** **Stream** — абстракция для обработки данных **по частям (chunks)**, не загружая всё в память. Четыре типа: **Readable** (источник), **Writable** (приёмник), **Duplex** (оба направления, например сокет), **Transform** (Duplex, который преобразует данные, например `zlib.createGzip()`). Главная проблема — **backpressure**: если источник быстрее приёмника, данные копятся в памяти. Решение: `writable.write()` возвращает `false`, когда внутренний буфер превысил `highWaterMark`, — нужно подождать событие `drain`. Всё это автоматически делает `stream.pipeline()` (а он же корректно закрывает потоки при ошибке, в отличие от `.pipe()`). **Buffer** — бинарные данные фиксированного размера (подкласс `Uint8Array`).

## Что именно спрашивают

- «Зачем нужны стримы? Чем `createReadStream` лучше `readFile`?»
- «Какие типы стримов бывают? Приведите примеры».
- «Что такое backpressure и как с ним работать?»
- «Чем `pipeline` лучше `pipe`?»
- «Что такое Buffer? Чем `alloc` отличается от `allocUnsafe`?»

## Зачем нужны стримы

`fs.readFile("2gb.log")` загрузит **весь файл** в память: расход RAM равен размеру файла, ответ клиенту начнётся только после полной загрузки. Стрим читает кусками (по умолчанию порядка десятков КиБ), память остаётся постоянной, а первый байт уходит клиенту сразу.

```js
import { createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";

// Отдаём огромный файл в ответ на запрос: память O(размер чанка), а не O(размер файла)
http.createServer(async (req, res) => {
  try {
    await pipeline(createReadStream("big.mp4"), res);
  } catch {
    /* клиент оборвал соединение — pipeline уже всё почистил */
  }
});
```

В Node стримами являются: `fs.createReadStream/WriteStream`, `http` (запрос `req` — Readable, ответ `res` — Writable), `net.Socket` (Duplex), `zlib`, `crypto` (хеши), `process.stdin/stdout`.

## Четыре типа

| Тип | Назначение | Пример |
|---|---|---|
| **Readable** | источник данных | `fs.createReadStream`, `http.IncomingMessage` |
| **Writable** | приёмник данных | `fs.createWriteStream`, `http.ServerResponse` |
| **Duplex** | читает и пишет независимо | `net.Socket` |
| **Transform** | Duplex, где выход вычисляется из входа | `zlib.createGzip()`, `crypto.createCipheriv()` |

### Режимы Readable

- **paused** (по умолчанию) — данные читают явно (`read()`);
- **flowing** — данные идут сами и приходят в события `data` (включается подпиской на `data`, вызовом `pipe()` или `resume()`).

Современный и удобный способ — **асинхронная итерация**:

```js
for await (const chunk of createReadStream("big.log")) {
  // chunk — Buffer (или строка, если задана кодировка)
}
```

## Backpressure

Ситуация: читаем файл с быстрого диска и пишем по медленной сети. Если писать без оглядки, данные накапливаются во внутреннем буфере Writable, и память растёт.

Механика:

1. У Writable есть `highWaterMark` — порог размера внутреннего буфера.
2. `write(chunk)` возвращает `true`, пока буфер меньше порога, и `false`, когда достиг его.
3. Получив `false`, источник должен **приостановиться** и ждать события `'drain'`.

```js
import { once } from "node:events";

async function writeMany(writable, lines) {
  for (const line of lines) {
    if (!writable.write(line)) {
      await once(writable, "drain"); // ждём, пока буфер освободится
    }
  }
  writable.end();
}
```

`pipe()` и `pipeline()` делают это автоматически. Ручная работа с `write` без проверки результата — частая причина утечек памяти.

## pipe против pipeline

```js
// pipe: ошибки НЕ пробрасываются, потоки НЕ закрываются автоматически
readable.pipe(gzip).pipe(writable);   // ошибка в readable оставит writable открытым → утечка дескрипторов

// pipeline: единая обработка ошибок + корректная очистка всех потоков
import { pipeline } from "node:stream/promises";
await pipeline(readable, gzip, writable);
```

`pipeline` умеет работать и с async-генераторами, и принимает `AbortSignal`:

```js
await pipeline(
  createReadStream("in.txt", "utf8"),
  async function* (source) {
    for await (const chunk of source) yield chunk.toUpperCase();
  },
  createWriteStream("out.txt")
);
```

## Собственный Transform

```js
import { Transform } from "node:stream";

const upper = new Transform({
  transform(chunk, _enc, cb) {
    cb(null, chunk.toString().toUpperCase());
  },
});
```

**Object mode** (`{ objectMode: true }`) позволяет передавать не байты, а произвольные JS-значения (например, объекты-строки CSV). Там `highWaterMark` считается в количестве объектов.

## Buffer

`Buffer` — последовательность байтов (подкласс `Uint8Array`). Используется для бинарных данных: файлы, сеть, криптография.

```js
const b = Buffer.from("Привет", "utf8");
b.length;              // 12 — это БАЙТЫ, а не символы (кириллица = 2 байта в UTF-8)
"Привет".length;       // 6 — символы
b.toString("hex");     // шестнадцатеричная строка
b.toString("base64");  // base64
Buffer.concat([b, Buffer.from("!")]);

Buffer.alloc(10);        // 10 байт, заполнены нулями — безопасно
Buffer.allocUnsafe(10);  // быстрее, но может содержать «мусор» из старой памяти → нельзя отдавать наружу без записи
```

### Подвох: многобайтовые символы на границе чанков

Если декодировать каждый чанк отдельно (`chunk.toString()`), символ, разрезанный границей между чанками, превратится в «�». Решение: `readable.setEncoding("utf8")` или `StringDecoder`, которые склеивают такие символы корректно.

## Web Streams

Помимо Node-стримов в современных версиях доступны стандартные **Web Streams** (`ReadableStream`, `WritableStream`, `TransformStream`), как в браузере и в `fetch` (`response.body` — `ReadableStream`). Между мирами есть конвертеры `Readable.toWeb()` / `Readable.fromWeb()`.

## Частые follow-up вопросы

**Что такое `highWaterMark`?**
Порог внутреннего буфера: для байтовых стримов — в байтах, для object mode — в объектах. Это не жёсткий лимит, а сигнал для backpressure.

**В чём разница событий `end` и `finish`?**
`end` — у Readable: данных больше нет. `finish` — у Writable: после `end()` все данные переданы системе. `close` — ресурс закрыт.

**Что произойдёт, если клиент оборвёт соединение во время `readStream.pipe(res)`?**
`pipe` не закроет `readStream` автоматически: утечка файлового дескриптора. `pipeline` решает проблему.

**Когда стримы не нужны?**
Для маленьких данных (конфиги, JSON на несколько КБ) стримы только усложняют код.

**Почему нельзя `JSON.parse` на стриме?**
JSON нужно целиком, чтобы быть валидным. Для больших данных используют потоковые форматы (NDJSON — одна запись на строку) и построчное чтение.

## Типичные ошибки

- `fs.readFile` на больших файлах и в обработчиках запросов.
- Игнорирование возвращаемого значения `write()`.
- `.pipe()` цепочки без обработки ошибок на каждом звене.
- Подсчёт «длины строки» через `buffer.length`.
- Использование `Buffer.allocUnsafe` без полной перезаписи.
