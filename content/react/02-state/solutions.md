## Решения

### Задание 1

- а) **1** — все три вызова используют один и тот же снимок `n = 0`.
- б) **3** — каждое функциональное обновление получает результат предыдущего.
- в) **6** — сначала `0 + 5 = 5`, затем `5 + 1`.
- г) **42** — последнее значение заменяет всё, что было накоплено.
- д) **11** — `5`, затем `5 * 2 = 10`, затем `10 + 1`.

Все результаты проверены запуском.

### Задание 2

После одного клика на «+1» в консоли:

```
handler: 0     ← в обработчике переменная n — снимок прошлого рендера
render: 1      ← новый рендер уже с n = 1
```

Таймер: если нажать «Показать через 2 секунды» при `n = 0` и затем три раза «+1», в консоли будет **`timer: 0`**. Колбэк создан в рендере, где `n` был `0`, и это значение «запомнено» замыканием. Через 2 секунды на экране уже `3`, а таймер напечатает старое. Если нажать таймер при `n = 1` — напечатает `1`, и так далее (проверено запуском). Чтобы читать актуальное значение в отложенном колбэке, используют `ref` (`useRef`) или функциональное обновление.

### Задание 3

```jsx
const add = (title) =>
  setTodos((ts) => [...ts, { id: crypto.randomUUID(), title, done: false }]);

const toggle = (id) =>
  setTodos((ts) => ts.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));

const remove = (id) => setTodos((ts) => ts.filter((t) => t.id !== id));

const rename = (id, title) =>
  setTodos((ts) => ts.map((t) => (t.id === id ? { ...t, title } : t)));
```

Все четыре операции проверены: добавление, переключение, переименование, удаление. Почему исходный код не работал: `push`/присваивание меняют существующий массив, а `setTodos(todos)` передаёт **ту же ссылку**, `Object.is` возвращает `true`, и React пропускает обновление.

Используем `crypto.randomUUID()` (доступен в браузерах и Node): `Date.now()` может дать одинаковые id при быстрых нажатиях. Id создаётся один раз при добавлении, а не при рендере.

### Задание 4

```jsx
function UserList({ users }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);   // храним id, а не копию

  const filtered = users.filter((u) => u.name.toLowerCase().includes(query.toLowerCase()));
  const count = filtered.length;                          // вычисляется из filtered
  const selected = users.find((u) => u.id === selectedId) ?? null;
  // ...
}
```

Остался один «настоящий» источник правды для фильтра (`query`) и один для выбора (`selectedId`). `filtered` и `count` — производные: они пересчитываются при каждом рендере (для тяжёлых вычислений можно обернуть в `useMemo`).

Проблема копии `selected`: если пользователя отредактировали в `users`, копия в состоянии останется старой. Проверено: с `selectedId` после правки имени в `users` экран показывает `Ann (edited)`.

### Задание 5

```jsx
const toC = (f) => ((f - 32) * 5) / 9;
const toF = (c) => (c * 9) / 5 + 32;
const fmt = (x) => (Number.isNaN(x) ? "" : String(Math.round(x * 100) / 100));

function Temperature() {
  const [{ scale, value }, setT] = useState({ scale: "c", value: "" });
  const num = parseFloat(value);
  const c = scale === "c" ? value : fmt(toC(num));
  const f = scale === "f" ? value : fmt(toF(num));

  return (
    <div>
      <input value={c} onChange={(e) => setT({ scale: "c", value: e.target.value })} />
      <input value={f} onChange={(e) => setT({ scale: "f", value: e.target.value })} />
    </div>
  );
}
```

Единый источник правды — `{ scale, value }`: то, что ввёл пользователь, и шкала ввода. Второе значение вычисляется. Хранить строку (а не число) нужно, чтобы не ломать ввод промежуточных состояний вроде `"1."` или пустой строки. Проверено: `100 °C → 212 °F`, `32 °F → 0 °C`, пустая строка → пустая.

### Задание 6

```js
// cart.mjs
export function cartReducer(state, action) {
  switch (action.type) {
    case "add": {
      const exists = state.items.some((i) => i.id === action.item.id);
      return {
        ...state,
        items: exists
          ? state.items.map((i) => (i.id === action.item.id ? { ...i, qty: i.qty + 1 } : i))
          : [...state.items, { ...action.item, qty: 1 }],
      };
    }
    case "remove":
      return { ...state, items: state.items.filter((i) => i.id !== action.id) };
    case "setQty":
      return {
        ...state,
        items:
          action.qty <= 0
            ? state.items.filter((i) => i.id !== action.id)
            : state.items.map((i) => (i.id === action.id ? { ...i, qty: action.qty } : i)),
      };
    case "clear":
      return { ...state, items: [] };
    default:
      throw new Error(`Unknown action: ${action.type}`);
  }
}
```

```js
// cart.test.mjs — запуск: node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import { cartReducer } from "./cart.mjs";

const empty = { items: [] };

test("add: новый товар получает qty 1, повторное добавление увеличивает qty", () => {
  const s1 = cartReducer(empty, { type: "add", item: { id: "a", title: "Книга" } });
  assert.deepEqual(s1.items, [{ id: "a", title: "Книга", qty: 1 }]);
  const s2 = cartReducer(s1, { type: "add", item: { id: "a", title: "Книга" } });
  assert.equal(s2.items[0].qty, 2);
});

test("setQty <= 0 удаляет товар, исходное состояние не мутируется", () => {
  const start = { items: [{ id: "a", qty: 2 }] };
  const frozen = structuredClone(start);
  const next = cartReducer(start, { type: "setQty", id: "a", qty: 0 });
  assert.deepEqual(next.items, []);
  assert.deepEqual(start, frozen);
});

test("remove и clear; неизвестное действие бросает ошибку", () => {
  const s = { items: [{ id: "a", qty: 1 }, { id: "b", qty: 1 }] };
  assert.deepEqual(cartReducer(s, { type: "remove", id: "a" }).items, [{ id: "b", qty: 1 }]);
  assert.deepEqual(cartReducer(s, { type: "clear" }).items, []);
  assert.throws(() => cartReducer(s, { type: "boom" }), /Unknown action/);
});
```

Тесты проходят (3 из 3). Преимущество редьюсера: логику можно проверить без React и браузера.

Подключение: `const [cart, dispatch] = useReducer(cartReducer, { items: [] });`, затем `dispatch({ type: "add", item })`.

### Задание 7

`useState(color)` использует `color` **только при первом рендере**; при смене пропса состояние не обновляется. Проверено: пропс изменился с `blue` на `green`, а в состоянии остался прежний цвет.

Способы:

1. **Не копировать**: если локальных правок нет, использовать `props.color` напрямую.
2. **Назвать проп `initialColor` и пересоздавать компонент через `key`**, когда меняется сущность.

Для случая «пользователь может править значение, при смене `userId` оно должно сброситься» подходит второй способ:

```jsx
function Badge({ initialColor }) {
  const [c, setC] = useState(initialColor);
  return <span style={{ color: c }} onClick={() => setC("red")}>badge</span>;
}

<Badge key={userId} initialColor={user.color} />
```

Проверено: после правки (`red`) смена `key` даёт новое начальное значение `green`.
