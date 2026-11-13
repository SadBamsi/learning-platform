## Решения

### Задание 1

1. `^1.2.3` (`>=1.2.3 <2.0.0`): подходят `1.2.3`, `1.2.9`, `1.3.0`. Не подходят `2.0.0`, `0.2.5`, `0.3.0`.
2. `~1.2.3` (`>=1.2.3 <1.3.0`): подходят `1.2.3`, `1.2.9`. Не подходят `1.3.0`, `2.0.0`, `0.x`.
3. `^0.2.3` (`>=0.2.3 <0.3.0`): подходит только `0.2.5`. Версия `0.3.0` не подходит, потому что для `0.x` минорная версия считается «ломающей».
4. `>=1.2.0 <2.0.0`: подходят `1.2.3`, `1.2.9`, `1.3.0`.

### Задание 2

- После `npm i fastify` в `package.json` появляется `"fastify": "^<версия>"`, после `npm i -D typescript` — запись в `devDependencies`.
- В `package-lock.json` для каждого пакета (включая транзитивные) есть `version`, `resolved` (URL tarball) и `integrity` (хеш SHA-512): npm проверяет их при установке.
- `npm ci` с рассинхронизацией `package.json` и lock-файла **завершается ошибкой** (сообщает, что lock-файл не соответствует манифесту). Это защита от «тихих» отличий в CI. `npm install` в этой ситуации **обновит** lock-файл под новый `package.json`.

### Задание 3

```bash
npm i express
npm ls --all | wc -l          # примерная оценка числа записей в дереве
npm ls debug                  # кто и какую версию debug использует
npm explain debug             # цепочка зависимостей до корня
npm dedupe                    # попытка слить дубликаты
```

`npm explain` показывает путь `debug ← <пакет> ← express ← ваш проект`. Количество пакетов зависит от версии: сверяйтесь с фактическим выводом у себя.

### Задание 4

```js
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("node_modules");
const HOOKS = ["preinstall", "install", "postinstall"];

async function* packages(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.name.startsWith("@")) yield* packages(full);   // scoped: @scope/name
    else yield full;
  }
}

for await (const dir of packages(root)) {
  try {
    const pkg = JSON.parse(await readFile(path.join(dir, "package.json"), "utf8"));
    const found = HOOKS.filter((h) => pkg.scripts?.[h]);
    if (found.length) console.log(`${pkg.name}@${pkg.version}:`, found.map((h) => `${h}=${pkg.scripts[h]}`).join("; "));
  } catch { /* нет package.json — пропускаем */ }
}
```

Важность: эти скрипты выполняются автоматически при установке с правами пользователя (и часто в CI с доступом к секретам) и могут красть токены или внедрять вредоносный код. Ограничения: `npm ci --ignore-scripts` (потом вручную запускать нужные, например `npm rebuild <pkg>`), конфигурация `ignore-scripts=true` в `.npmrc`, установка в контейнере без секретов, ревью обновлений и блокировка неожиданных новых install-скриптов, в pnpm — список разрешённых пакетов для скриптов.

### Задание 5

Код работает, потому что npm «поднял» `debug` (зависимость `express`) в корневой `node_modules`, и обычное разрешение модулей его находит. Это **phantom dependency**: проект зависит от пакета, который не объявил. Если `express` обновится и перестанет использовать `debug` (или поменяется версия), код сломается без изменений в вашем `package.json`. Обнаружение: правило `import/no-extraneous-dependencies`, `depcheck`, строгий **pnpm** (в `node_modules` корня лежат только объявленные зависимости, поэтому импорт упадёт сразу). Исправление: `npm i debug`.

### Задание 6

```json
// package.json (корень)
{ "name": "mono", "private": true, "workspaces": ["packages/*"] }

// packages/lib/package.json
{ "name": "lib", "version": "1.0.0", "type": "module", "main": "index.js" }
// packages/lib/index.js
export const greet = (n) => `Hello, ${n}!`;

// packages/app/package.json
{ "name": "app", "version": "1.0.0", "type": "module", "dependencies": { "lib": "*" }, "scripts": { "start": "node index.js" } }
// packages/app/index.js
import { greet } from "lib";
console.log(greet("workspace"));
```

`npm install` создаст симлинк `node_modules/lib → ../packages/lib`; `npm run start --workspace=app` напечатает `Hello, workspace!`. Проверка: `ls -l node_modules | grep lib`. Внимание: имя `lib` может конфликтовать с пакетом из реестра, поэтому реальные внутренние пакеты называют со scope (`@mycompany/lib`).

### Задание 7

Пример ответа:

«Воспроизводимость: `package-lock.json` в репозитории, в CI и Docker только `npm ci`, версия Node зафиксирована (`engines`, `.nvmrc`, базовый образ), для рантайма `--omit=dev`. Диапазоны: `^` для обычных библиотек, строгие версии для критичных; никаких `latest`/`*`. Обновления: Dependabot/Renovate создают PR, тесты и ревью changelog перед мерджем; `npm audit` в пайплайне с порогом серьёзности. Безопасность цепочки поставок: минимум зависимостей, выбор поддерживаемых пакетов, `--ignore-scripts` с выборочным разрешением, приватный реестр и scoped-имена для внутренних пакетов против dependency confusion, 2FA и provenance для собственных публикаций, сканирование образов. Для срочных уязвимостей транзитивных пакетов — `overrides` до выхода исправления».
