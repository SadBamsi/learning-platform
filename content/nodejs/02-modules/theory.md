## 1. Зачем нужны модули

Если весь код лежит в одном файле, он быстро становится нечитаемым. Кроме того, в старом браузерном JavaScript все переменные из разных `<script>` попадали в один глобальный scope, и имена конфликтовали.

**Модуль** — это файл (или пакет), у которого:
- **собственная область видимости**: переменные внутри не видны снаружи, пока ты явно их не *экспортируешь*;
- **явные зависимости**: ты видишь, что именно модуль импортирует;
- **одноразовая загрузка**: модуль выполняется один раз, а результат кэшируется.

В Node.js сосуществуют две модульные системы: **CommonJS (CJS)** — исторически первая, и **ES Modules (ESM)** — стандарт языка. Нужно знать обе: в реальных проектах и в npm встречаются обе.

---

## 2. CommonJS (CJS)

### 2.1. Базовое использование

```js
// math.js
function add(a, b) { return a + b; }
function mul(a, b) { return a * b; }

module.exports = { add, mul };
```

```js
// app.js
const { add, mul } = require("./math");   // расширение .js можно опустить
console.log(add(2, 3));   // 5
console.log(mul(2, 3));   // 6
```

- `require(path)` **синхронно** читает, выполняет и возвращает экспорт модуля.
- Относительные пути начинаются с `./` или `../`. Без них Node.js ищет пакет (в `node_modules` или среди встроенных модулей).

### 2.2. Как это работает «под капотом»: функция-обёртка

Node.js оборачивает код каждого CJS-файла в функцию:

```js
(function (exports, require, module, __filename, __dirname) {
  // ...твой код...
});
```

Отсюда следствия:
- переменные, объявленные в файле через `const`/`let`/`var`, **локальны для файла**, а не глобальны;
- `require`, `module`, `exports`, `__filename`, `__dirname` доступны «из ниоткуда» — на самом деле это параметры обёртки.

```js
console.log(__filename);  // полный путь к текущему файлу
console.log(__dirname);   // полный путь к папке файла
```

### 2.3. `module.exports` и `exports`: в чём разница

Изначально `exports` — это просто **ссылка на тот же объект**, что и `module.exports`. Возвращает `require` всегда именно `module.exports`.

```js
// Работает: добавляем свойства в общий объект
exports.add = (a, b) => a + b;

// Работает: полностью заменяем module.exports
module.exports = { add: (a, b) => a + b };

// НЕ работает! Мы переприсвоили локальную переменную exports,
// но module.exports остался прежним пустым объектом.
exports = { add: (a, b) => a + b };
```

Запомни: **для экспорта одной функции или класса используй `module.exports = ...`**, для нескольких значений — либо `module.exports = { a, b }`, либо `exports.a = ...`, но не смешивай эти подходы.

```js
// Экспорт одного класса
class User { /* ... */ }
module.exports = User;

// Использование
const User = require("./user");
const u = new User();
```

### 2.4. Кэширование модулей

Модуль выполняется **только при первом `require`**. Результат кладётся в `require.cache`. Все последующие `require` того же файла возвращают *тот же самый объект*.

```js
// counter.js
console.log("counter.js загружен");
let count = 0;
module.exports = { inc: () => ++count, get: () => count };
```

```js
// app.js
const a = require("./counter");
const b = require("./counter");   // повторной загрузки нет, лога не будет
a.inc();
console.log(b.get());   // 1 — это один и тот же объект
console.log(a === b);   // true
```

Это превращает модуль в удобный «синглтон» (например, для подключения к базе данных или конфигурации).

### 2.5. Алгоритм поиска модуля

Что делает `require("X")`:

1. Если `X` — **встроенный модуль** (`fs`, `path`, `node:fs`), возвращается он.
2. Если `X` начинается с `./`, `../` или `/` — это **файл или папка**:
   - пробует файл точно по имени, затем с расширениями `.js`, `.json`, `.node`;
   - если это папка, ищет `package.json` с полем `main`, иначе `index.js`.
3. Иначе это **пакет**: Node.js поднимается вверх по дереву каталогов и ищет в каждой папке `node_modules/X`: `./node_modules`, `../node_modules`, `../../node_modules` и так далее.

Можно подключать и JSON-файлы: `const config = require("./config.json")` — вернётся уже распарсенный объект.

### 2.6. Циклические зависимости

Если `a.js` требует `b.js`, а `b.js` требует `a.js`, Node.js не уйдёт в бесконечный цикл, но `b.js` получит **частично заполненный** экспорт `a.js` (то, что `a` успел экспортировать к моменту вызова `require("./b")`).

```js
// a.js
exports.loaded = false;
const b = require("./b");
exports.loaded = true;

// b.js
const a = require("./a");
console.log("в b: a.loaded =", a.loaded);   // false — a ещё не закончил выполнение
```

Лучше избегать циклов: выноси общий код в третий модуль.

---

## 3. ES Modules (ESM)

### 3.1. Синтаксис

```js
// math.mjs
export function add(a, b) { return a + b; }       // именованный экспорт
export const PI = 3.14159;
export default function mul(a, b) { return a * b; }   // экспорт по умолчанию (один на модуль)
```

```js
// app.mjs
import mul, { add, PI } from "./math.mjs";
import * as math from "./math.mjs";              // всё как объект-пространство имён
import { add as sum } from "./math.mjs";          // переименование

console.log(add(1, 2), mul(2, 3), PI);
```

### 3.2. Как включить ESM

Node.js считает файл ES-модулем, если:
- у файла расширение **`.mjs`**; или
- в ближайшем `package.json` указано **`"type": "module"`** (тогда все `.js` в этой области — ESM; для CJS-файлов нужно расширение `.cjs`).

Без этих признаков `.js` трактуется как CommonJS.

### 3.3. Особенности ESM

- **Статический анализ.** `import`/`export` разбираются *до* выполнения кода, поэтому инструменты умеют находить неиспользуемый код (tree-shaking). Поэтому `import` пишут только на верхнем уровне файла.
- **Живые привязки (live bindings).** Импортированное значение — это не копия, а ссылка на переменную экспортирующего модуля:

  ```js
  // counter.mjs
  export let count = 0;
  export function inc() { count++; }

  // app.mjs
  import { count, inc } from "./counter.mjs";
  console.log(count); // 0
  inc();
  console.log(count); // 1 — значение обновилось!
  ```
  В CommonJS получилось бы `0` и `0` при деструктуризации, так как значение скопировалось бы при `require`.
- **Строгий режим** включён всегда (`"use strict"` не нужен).
- **Расширения обязательны** в относительных путях: `./math.mjs`, `./utils.js`, а не `./math`.
- **Top-level await**: `await` можно использовать прямо на верхнем уровне модуля.

  ```js
  import { readFile } from "node:fs/promises";
  const text = await readFile("a.txt", "utf8");
  console.log(text);
  ```
- **Нет `__dirname`/`__filename`/`require`.** Вместо них:

  ```js
  console.log(import.meta.url);       // file:///C:/project/app.mjs
  console.log(import.meta.dirname);   // папка файла (Node 20.11+/21.2+)
  console.log(import.meta.filename);  // путь к файлу (Node 20.11+/21.2+)
  ```

### 3.4. Динамический импорт

Статический `import` нельзя вызвать внутри `if` или функции, а `import()` — можно. Он возвращает **промис**:

```js
if (process.env.DEBUG) {
  const { debugTools } = await import("./debug.mjs");
  debugTools.enable();
}
```

Через `import()` можно подключать ESM даже из CommonJS-файлов.

### 3.5. Совместимость CJS и ESM

- **ESM может импортировать CJS**: `import pkg from "./legacy.cjs"` — `module.exports` становится default-импортом.
- **CJS не может синхронно `require` ESM** (в большинстве версий; в свежих версиях Node.js появилась поддержка `require(esm)` для модулей без top-level await, но рассчитывать на это в старом коде не стоит). Универсальный способ — динамический `import()`:

  ```js
  // в CommonJS-файле
  async function main() {
    const { add } = await import("./math.mjs");
    console.log(add(1, 2));
  }
  main();
  ```

### 3.6. Сравнение

| | CommonJS | ESM |
|---|---|---|
| Синтаксис | `require` / `module.exports` | `import` / `export` |
| Загрузка | синхронная | асинхронная |
| Импорт вычисляется | во время выполнения | статически, до выполнения |
| Значения | копия на момент `require` | живая ссылка |
| `__dirname` | есть | `import.meta.dirname` |
| top-level `await` | нет | да |
| Строгий режим | по желанию | всегда |
| Где встречается | старые проекты, много пакетов npm | современные проекты, браузеры |

**Рекомендация:** в новых проектах используй ESM (`"type": "module"`), а CJS знай для чтения старого кода.

---

## 4. Встроенные (core) модули

Подключаются без установки. Используй префикс `node:` — он сразу показывает, что это ядро Node.js, и защищает от подмены одноимённым пакетом из npm.

```js
import fs from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
```

Самые частые модули:

| Модуль | Назначение |
|---|---|
| `fs`, `fs/promises` | файловая система |
| `path` | работа с путями |
| `os` | информация об ОС: CPU, память, домашняя папка |
| `http`, `https` | HTTP-клиент и сервер |
| `url` | разбор URL |
| `events` | `EventEmitter` — шаблон «издатель/подписчик» |
| `stream` | потоковая обработка данных |
| `crypto` | хеши, шифрование, случайные значения |
| `child_process` | запуск других процессов |
| `worker_threads` | дополнительные JS-потоки |
| `assert`, `node:test` | проверки и встроенный тест-раннер |

### Пример: модуль `path`

Никогда не склеивай пути строками, ведь в Windows разделитель `\`, в Linux `/`:

```js
import path from "node:path";

console.log(path.join("folder", "sub", "file.txt"));   // folder\sub\file.txt (Windows)
console.log(path.resolve("file.txt"));                  // полный абсолютный путь
console.log(path.basename("/a/b/file.txt"));            // file.txt
console.log(path.extname("/a/b/file.txt"));             // .txt
console.log(path.dirname("/a/b/file.txt"));             // /a/b
console.log(path.parse("/a/b/file.txt"));
// { root: '/', dir: '/a/b', base: 'file.txt', ext: '.txt', name: 'file' }
```

### Пример: модуль `os`

```js
import os from "node:os";
console.log(os.platform());               // win32 / linux / darwin
console.log(os.cpus().length);            // число логических ядер
console.log(os.totalmem() / 1024 ** 3);   // всего ОЗУ в ГБ
console.log(os.homedir());                // домашняя папка пользователя
```

---

## 5. npm и package.json

### 5.1. Что такое npm

**npm** — это три вещи сразу: реестр пакетов (npmjs.com), консольная утилита и формат описания проекта (`package.json`). Альтернативы с тем же форматом: **pnpm**, **yarn**, **bun**.

### 5.2. Создание проекта

```bash
npm init -y        # создаёт package.json с настройками по умолчанию
```

Пример `package.json`:

```json
{
  "name": "my-app",
  "version": "1.0.0",
  "description": "Учебный проект",
  "type": "module",
  "main": "app.js",
  "scripts": {
    "start": "node app.js",
    "dev": "node --watch app.js",
    "test": "node --test"
  },
  "dependencies": {
    "express": "^4.19.2"
  },
  "devDependencies": {
    "eslint": "^9.0.0"
  },
  "engines": {
    "node": ">=20"
  }
}
```

Основные поля:
- `name`, `version` — идентификатор пакета (имя в нижнем регистре, версия по semver);
- `type` — `"module"` для ESM или `"commonjs"` (по умолчанию);
- `main` — точка входа пакета для `require`;
- `exports` — современная замена `main`, позволяет задать разные входы для `import`/`require` и закрыть внутренние файлы от внешнего доступа;
- `scripts` — именованные команды, запускаются `npm run <имя>` (для `start` и `test` слово `run` необязательно);
- `dependencies` — нужны приложению в работе;
- `devDependencies` — нужны только при разработке (тесты, линтеры, сборщики);
- `engines` — требуемая версия Node.js.

### 5.3. Установка пакетов

```bash
npm install express          # добавить зависимость (npm i express)
npm install -D eslint        # добавить в devDependencies
npm install                  # установить все зависимости из package.json
npm uninstall express        # удалить
npm update                   # обновить в рамках допустимых диапазонов
npm list --depth=0           # список прямых зависимостей
npm outdated                 # показать устаревшие пакеты
npm install -g typescript    # глобальная установка (для CLI-утилит)
```

Что создаётся при установке:
- папка **`node_modules/`** — сами пакеты (огромная, **не коммитится в git**, добавь её в `.gitignore`);
- файл **`package-lock.json`** — точные версии всех пакетов и их зависимостей (**коммитится**, чтобы у всех были одинаковые версии).

### 5.4. Семантическое версионирование (semver)

Версия имеет вид `MAJOR.MINOR.PATCH`, например `4.19.2`:

- **PATCH** (`4.19.3`) — исправление ошибок, совместимо;
- **MINOR** (`4.20.0`) — новая функциональность, совместимо;
- **MAJOR** (`5.0.0`) — ломающие изменения.

Префиксы в `package.json`:
- `^4.19.2` — разрешены обновления MINOR и PATCH (`4.x.x`, но не `5.0.0`);
- `~4.19.2` — разрешены только PATCH (`4.19.x`);
- `4.19.2` — только эта точная версия.

### 5.5. npx и скрипты

`npx` запускает пакет без глобальной установки: `npx create-next-app@latest`. Этой командой обычно создают проекты на Next.js.

Скрипты могут вызывать бинарники из `node_modules/.bin` без полного пути (`"lint": "eslint ."`).

### 5.6. Безопасность зависимостей

Установка пакета — это запуск чужого кода на твоём компьютере. Базовые привычки:
- проверяй популярность, дату последнего обновления и репозиторий пакета;
- меньше зависимостей — меньше рисков; не ставь пакет ради одной функции;
- регулярно выполняй `npm audit`;
- не отключай `package-lock.json`.

---

## 6. Типичные ошибки

1. **`ReferenceError: require is not defined in ES module scope`** — ты включил `"type": "module"`, но пишешь `require`. Используй `import`.
2. **`ReferenceError: __dirname is not defined`** — то же самое, в ESM используй `import.meta.dirname`.
3. **`ERR_MODULE_NOT_FOUND`** — в ESM забыли расширение (`./utils` вместо `./utils.js`).
4. **`Cannot use import statement outside a module`** — используешь `import` в CJS-файле. Добавь `"type": "module"` или переименуй в `.mjs`.
5. **Пустой объект после `require`** — циклическая зависимость или `exports = ...` вместо `module.exports = ...`.
6. **Коммит `node_modules`** — добавь в `.gitignore`.

---

## 7. Краткое резюме урока

- Модуль — файл с собственной областью видимости; Node.js поддерживает **CommonJS** и **ESM**.
- В CJS файл обёрнут в функцию, `require` синхронный, результат **кэшируется**; экспорт — через `module.exports`.
- В ESM `import`/`export` статические, привязки **живые**, есть top-level `await`, расширения обязательны.
- Встроенные модули подключай с префиксом `node:`.
- `package.json` описывает проект, `package-lock.json` фиксирует версии, `node_modules` не коммитят.
- Semver: `^` разрешает MINOR и PATCH, `~` только PATCH.
