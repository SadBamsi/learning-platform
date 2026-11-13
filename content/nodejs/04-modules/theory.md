> **Ответ за 30 секунд.** В Node.js две модульные системы. **CommonJS** (`require` / `module.exports`) — исторически первая: загрузка **синхронная** и динамичная (`require` — обычная функция, её можно вызвать в `if`), модуль выполняется один раз и **кэшируется**. **ES Modules** (`import` / `export`) — стандарт языка: статический анализ зависимостей, асинхронная загрузка, **live bindings** (импорт — «живая ссылка», а не копия), `top-level await`, всегда strict mode. ESM включается расширением `.mjs` или `"type": "module"` в `package.json`. Новые проекты пишут на ESM; CommonJS остаётся в старых пакетах.

## Что именно спрашивают

- «Чем отличаются CommonJS и ES Modules?»
- «Что такое `module.exports` и чем он отличается от `exports`?»
- «Как работает кэширование модулей? Что с циклическими зависимостями?»
- «Можно ли импортировать CJS из ESM и наоборот?»
- «Откуда в ESM взять `__dirname`?»

## CommonJS

```js
// math.js
const PI = 3.14;
function add(a, b) { return a + b; }
module.exports = { add, PI };

// app.js
const { add } = require("./math");   // синхронно читает, выполняет и кэширует
```

### Как это работает «под капотом»

Node оборачивает каждый CJS-файл в функцию:

```js
(function (exports, require, module, __filename, __dirname) {
  // ваш код
});
```

Поэтому `require`, `module`, `__dirname` — не глобальные переменные, а **параметры** обёртки, а переменные, объявленные в файле, не попадают в глобальную область.

### `exports` против `module.exports`

В начале `exports === module.exports` (одна и та же ссылка на пустой объект). Наружу отдаётся именно **`module.exports`**.

```js
exports.a = 1;                 // ок: добавляем свойство в общий объект
module.exports = { b: 2 };     // ок: подменяем весь экспорт

exports = { c: 3 };            // НЕ работает: переприсвоили локальную переменную,
                               // module.exports остался прежним
```

### Кэширование

Первый `require` выполняет файл и сохраняет `module.exports` в `require.cache` (ключ — абсолютный путь). Повторный `require` возвращает **тот же объект** без выполнения кода. Отсюда:

- модуль-синглтон «из коробки» (например, подключение к БД);
- побочные эффекты (`console.log` на верхнем уровне) выполняются один раз;
- чтобы перезагрузить модуль, нужно `delete require.cache[require.resolve("./x")]` (в основном для тестов).

### Алгоритм поиска

`require("x")`: сначала встроенный модуль (`fs`, `node:fs`) → если путь начинается с `./`, `../`, `/`, то файл/каталог (`x.js`, `x.json`, `x/index.js`, поле `main`) → иначе поиск в `node_modules` вверх по иерархии каталогов.

### Циклические зависимости

```js
// a.js
exports.loaded = false;
const b = require("./b");        // запускается b.js
exports.loaded = true;

// b.js
const a = require("./a");        // a ещё не завершён: вернётся ЧАСТИЧНЫЙ exports
console.log(a.loaded);           // false
```

Node не падает, но второй модуль получает **неполный** экспорт на момент `require`. Решения: вынести общий код в третий модуль, использовать `require` внутри функции (ленивая загрузка), пересмотреть архитектуру.

## ES Modules

```js
// math.mjs
export const PI = 3.14;
export function add(a, b) { return a + b; }
export default class Calculator {}

// app.mjs
import Calculator, { add, PI } from "./math.mjs";   // расширение обязательно
import * as math from "./math.mjs";
const lazy = await import("./heavy.mjs");          // динамический import()
```

### Включение ESM

- расширение `.mjs`, **или**
- `"type": "module"` в ближайшем `package.json` (тогда `.js` = ESM, а CJS-файлы называют `.cjs`).

### Особенности

| Свойство | CommonJS | ES Modules |
|---|---|---|
| Синтаксис | `require` / `module.exports` | `import` / `export` |
| Загрузка | синхронная | асинхронная (парсинг → связывание → выполнение) |
| Зависимости | можно вычислять динамически | статические (`import` на верхнем уровне), динамические через `import()` |
| Экспорт | копия ссылки на объект | **live bindings**: импорт отражает текущее значение |
| `top-level await` | нет | **да** |
| Strict mode | по желанию | всегда |
| `__dirname`, `__filename` | есть | нет: `import.meta.dirname` и `import.meta.filename` (Node 20.11+) |
| `require`, `module` | есть | нет |
| Расширение в путях | можно опускать | **обязательно** для относительных импортов |
| Tree shaking | практически невозможен | возможен благодаря статическому анализу |

### Live bindings

```js
// counter.mjs
export let count = 0;
export function inc() { count++; }

// app.mjs
import { count, inc } from "./counter.mjs";
console.log(count); // 0
inc();
console.log(count); // 1 — импорт видит обновление
// count = 5;        // TypeError: импорт доступен только для чтения
```

В CommonJS `const { count } = require(...)` скопировал бы значение примитива, и обновление не было бы видно.

### Корень/`this`

В ESM `this` на верхнем уровне — `undefined`; в CJS — `module.exports`.

### Импорт JSON

```js
import cfg from "./config.json" with { type: "json" };
```

Атрибут `with { type: "json" }` обязателен для импорта JSON в ESM.

## Совместимость CJS ↔ ESM

- **ESM → CJS**: `import pkg from "./legacy.cjs"` работает. `default` — это `module.exports`. Именованные импорты (`import { a }`) доступны, только если Node смог статически определить экспорты CJS-файла (например, `exports.a = …` или `module.exports = { a, b }`); для `module.exports = { a: 1 }` — нет, там берите `default` и деструктурируйте.
- **CJS → ESM**: исторически только через динамический `await import("./x.mjs")` (асинхронно). В современных версиях (без флага с **Node 20.19 / 22.12**) работает и `require()` для ESM-модулей, **если они полностью синхронные** (без top-level await).
- Пакеты, поддерживающие оба формата («dual package»), описывают это через поле `exports` в `package.json` (условные экспорты: `import` / `require`).

## Префикс `node:`

`import fs from "node:fs"` явно показывает, что это встроенный модуль, исключая подмену одноимённым пакетом из `node_modules`. Есть модули, доступные **только** с префиксом (например, `node:test`).

## Частые follow-up вопросы

**Почему в ESM нельзя опустить расширение?**
ESM использует URL-подобное разрешение без «угадывания» расширений и `index.js`, как это делает CommonJS. Это упрощает и ускоряет загрузку и делает её предсказуемой.

**Почему ESM лучше для tree shaking?**
Импорты/экспорты статичны: сборщик может определить, какие экспорты не используются, не выполняя код. `require` с динамическим аргументом этого не позволяет.

**Что произойдёт при циклическом `import`?**
Из-за live bindings и раздельной фазы связывания ESM допускает циклы лучше, но обращение к ещё не инициализированному `let/const`-экспорту даст `ReferenceError` (TDZ). Функции-декларации «поднимаются» и доступны.

**Как получить `__dirname` в ESM?**
`import.meta.dirname` (Node 20.11+) или `path.dirname(fileURLToPath(import.meta.url))` в старых версиях.

**Чем `require` отличается от `import()`?**
`require` синхронный и возвращает значение; `import()` асинхронный, возвращает промис и работает в обоих типах модулей.

## Типичные ошибки

- `exports = ...` вместо `module.exports = ...`.
- Попытка использовать `require` в ESM (`ReferenceError: require is not defined in ES module scope`) или `import` в CJS (`SyntaxError: Cannot use import statement outside a module`).
- Забытое расширение в относительном импорте ESM.
- Ожидание, что `import { x }` из CJS всегда сработает.
- Выполнение дорогих операций на верхнем уровне модуля: они блокируют загрузку всего графа, особенно с `top-level await`.
