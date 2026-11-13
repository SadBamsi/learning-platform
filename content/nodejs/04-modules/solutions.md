## Решения

### Задание 1

- **A** → `{ x: 1 }`: добавили свойство в объект `module.exports`.
- **B** → `{}`: `exports = ...` лишь переназначил локальную переменную. Наружу отдаётся `module.exports`, он остался пустым объектом.
- **C** → `{ x: 1 }`: `module.exports` заменён новым объектом. Последняя строка `exports.y = 2` пишет в **старый** объект, поэтому `y` не попадает в экспорт.

### Задание 2

```js
// counter.js
console.log("loaded");
let n = 0;
module.exports = { inc: () => ++n };

// a.js
module.exports = require("./counter");
// b.js
module.exports = require("./counter");

// main.js
const a = require("./a");
const b = require("./b");
console.log(a.inc(), b.inc());          // 1 2
console.log(a === b);                    // true
console.log(Object.keys(require.cache)); // содержит путь counter.js
```

`loaded` напечатается **один раз**: после первого `require` результат лежит в `require.cache`. Счётчик общий, потому что оба модуля получили один и тот же объект.

### Задание 3

```js
// a.js
exports.loaded = false;
const b = require("./b");
console.log("в a: b.sawA =", b.sawA);
exports.loaded = true;

// b.js
const a = require("./a");           // частичный экспорт a: { loaded: false }
exports.sawA = a.loaded;            // false
```

Исправление 1 (ленивый `require`):

```js
// b.js
exports.check = () => require("./a").loaded; // вызов позже, когда a уже загружен
```

Исправление 2: вынести общие данные/функции в `shared.js`, который не зависит ни от `a`, ни от `b`; тогда цикл исчезает.

### Задание 4

```json
// package.json
{ "type": "module" }
```

```js
// counter.js
console.log("loaded");
let n = 0;
export const inc = () => ++n;

// main.js
import { inc } from "./counter.js";            // расширение обязательно
import data from "./data.json" with { type: "json" };

console.log(import.meta.filename);             // путь к файлу
console.log(import.meta.dirname);              // путь к каталогу
console.log(inc(), data);
```

Для Node старше 20.11: `path.dirname(fileURLToPath(import.meta.url))`.

### Задание 5

```js
// counter.cjs
let count = 0;
module.exports = { count, inc: () => { count++; } };
// main.cjs
const c = require("./counter.cjs");
console.log(c.count); c.inc(); console.log(c.count); // 0, 0 — значение скопировано
```

```js
// counter.mjs
export let count = 0;
export const inc = () => { count++; };
// main.mjs
import { count, inc } from "./counter.mjs";
console.log(count); inc(); console.log(count);       // 0, 1 — live binding
```

В CJS в `module.exports` попало **значение** `0` на момент создания объекта; в ESM экспорт — ссылка на переменную в модуле-источнике.

### Задание 6

1. `import x from "./lib.cjs"` → `x` — весь `module.exports` (`{ a: 1, b: 2 }`). А вот `import { a } from "./lib.cjs"` для `module.exports = { a: 1, b: 2 }` **упадёт** с `SyntaxError: Named export 'a' not found`: Node определяет именованные экспорты CJS статическим анализом (cjs-module-lexer), и он не видит ключи вида `a: 1`. Я проверял на Node 24: именованный импорт работает для `exports.a = 1`, для `module.exports = { a, b }` (сокращённая запись) и для `module.exports = require(...)`, но не работает для `module.exports = { a: 1 }` и `Object.defineProperty(exports, "a", { get() {...} })`. Надёжный способ: `import pkg from "./lib.cjs"; const { a } = pkg;`.
2. В CJS: `const mod = await import("./x.mjs")` внутри `async`-функции (в CJS нет top-level await, поэтому `(async () => { ... })()`).
3. На Node 22.12+/20.19+ `require("./sync.mjs")` работает для ESM без top-level await; для ESM с top-level await вы получите ошибку `ERR_REQUIRE_ASYNC_MODULE`.

### Задание 7

«В ESM используется стандартное URL-подобное разрешение модулей: путь указывает на конкретный ресурс, и рантайм не перебирает варианты (`.js`, `.json`, `index.js`). Это быстрее и однозначнее, а в браузере то же самое поведение, значит код переносим. CommonJS возник раньше и содержит набор эвристик поиска файла на диске при вызове `require`. Статичность `import` означает, что граф зависимостей известен до выполнения кода. Это даёт tree shaking (удаление неиспользуемого кода), раннее обнаружение ошибок в именах импортов, возможность параллельной загрузки и оптимизации, а также live bindings и top-level await».
