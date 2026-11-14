## Решения

### Задание 1

- а) **Пропустит** — примитив.
- б) **Отрендерится** — новая функция на каждый рендер.
- в) Пропустит — стабильная ссылка.
- г) **Отрендерится** — новый объект.
- д) Пропустит — стабильная ссылка.
- е) **Отрендерится** — JSX создаётся заново, и это новый объект-элемент.
- ж) **Отрендерится** — `children` (JSX) создаётся заново в рендере родителя.

Все варианты проверены запуском (а, в, д — пропуск; б, г, е — рендер; ж проверен на `memo(Box)` с `children`).

### Задание 2

| Вариант | Рендеров `Row` при вводе | При выборе строки |
|---|---|---|
| без мемоизации | 5 | 5 |
| только `memo(Row)` | 5 | 5 |
| только `useCallback` | 5 | 5 |
| `memo(Row)` + `useCallback` | **0** | **0** |

```jsx
const Row = memo(function Row({ item, onSelect }) {
  return <li onClick={() => onSelect(item.id)}>{item.name}</li>;
});

function App({ items }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const handleSelect = useCallback((id) => setSelected(id), []);   // setSelected стабилен
  return (
    <div>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <ul>
        {items.map((i) => <Row key={i.id} item={i} onSelect={handleSelect} />)}
      </ul>
      <p>{selected}</p>
    </div>
  );
}
```

Значения в таблице проверены запуском. Выбор строки не перерисовывает строки: `item` тот же, `handleSelect` стабилен.

### Задание 3

Компаратор сравнивает только `id`, поэтому при изменении `name` или `age` у того же пользователя компонент не обновится и покажет устаревшие данные (проверено: после смены имени остаётся старое). Исправления:

```jsx
// 1. Лучше вообще убрать компаратор: поверхностное сравнение + стабильные ссылки
const Row = memo(function Row({ user }) { /* ... */ });

// 2. Если компаратор нужен — сравнить все используемые поля
(prev, next) =>
  prev.user.id === next.user.id &&
  prev.user.name === next.user.name &&
  prev.user.age === next.user.age
```

### Задание 4

```jsx
// а) опустить состояние вниз
function ColorPicker() {
  const [color, setColor] = useState("red");
  return (
    <div style={{ color }}>
      <input value={color} onChange={(e) => setColor(e.target.value)} />
    </div>
  );
}
function Dashboard() {
  return (<><ColorPicker /><Chart /></>);
}

// б) children
function ColorBox({ children }) {
  const [color, setColor] = useState("red");
  return (
    <div style={{ color }}>
      <input value={color} onChange={(e) => setColor(e.target.value)} />
      {children}
    </div>
  );
}
function Dashboard() {
  return <ColorBox><Chart /></ColorBox>;
}
```

Замер на аналогичном примере: исходный вариант — 1 рендер тяжёлого компонента при вводе, вариант с `children` — 0.

В варианте (а) `Chart` стоит рядом с `ColorPicker`, и `Dashboard` не перерисовывается при вводе (его состояния нет), поэтому `Chart` остаётся нетронутым.

### Задание 5

- а) **Нет**: сложение дешевле, чем сравнение зависимостей.
- б) **Да, вероятно**: сортировка 20 000 элементов на каждый рендер дорога. Но сначала измерить (`console.time`).
- в) **Нет**: `<button>` не обёрнут в `memo`, стабильная ссылка ничего не даёт.
- г) **Да** (или перенести создание объекта внутрь эффекта и зависеть от `roomId`): иначе эффект будет перезапускаться на каждом рендере. Лучший вариант — зависимость от примитива `roomId`.
- д) **Нет, это ошибка**: побочные эффекты (запрос, `setX`) не место в `useMemo`; используйте `useEffect`.

### Задание 6

```jsx
function List({ items, query }) {
  const [clicks, setClicks] = useState(0);
  const shown = useMemo(
    () => items.filter((d) => d.name.includes(query)).sort((a, b) => a.name.localeCompare(b.name)),
    [items, query]
  );
  return (
    <div>
      <button onClick={() => setClicks(clicks + 1)}>{clicks}</button>
      <ul>{shown.map((d) => <li key={d.id}>{d.name}</li>)}</ul>
    </div>
  );
}
```

Проверено с счётчиком вызовов: два клика по кнопке — 0 пересчётов, смена `query` — 1 пересчёт. (Важно: массив `items` должен приходить стабильным; если родитель создаёт его на каждом рендере, кэш не сработает.)

Оценить необходимость: измерить время вычисления на реальных данных (`console.time` или React Profiler). Для маленьких массивов (десятки элементов) `useMemo` не нужен.

### Задание 7

1. Компилятор автоматически запомнит обработчик и JSX строк, поэтому `Row` пропустит рендер, даже если вручную ничего не мемоизировать (проверено на аналогичном примере: без компилятора `memo`-потомок рендерился 1 раз, с компилятором — 0).
2. Например: **мутация** `props`/`state` или внешних объектов во время рендера; **нарушение правил хуков** (условный вызов). Также код, зависящий от побочных эффектов в рендере.
3. Директива `"use no memo"` в начале тела функции компонента.
