## Задания на закрепление

### Задание 1. Пропустит ли `memo` рендер?

`Child` обёрнут в `memo`. Родитель перерисовывается при каждом клике. В каких случаях `Child` отрендерится?

```jsx
// а) <Child label="x" />
// б) <Child onClick={() => {}} />
// в) <Child onClick={handle} />            // handle = useCallback(() => {}, [])
// г) <Child cfg={{ a: 1 }} />
// д) <Child cfg={cfg} />                   // cfg = useMemo(() => ({ a: 1 }), [])
// е) <Child label={<b>x</b>} />
// ж) <Child><span>text</span></Child>
```

### Задание 2. Ускорить список

Ввод в поле перерисовывает все 5 (в реальности 1000) строк. Покажите **четыре** варианта: без мемоизации, только `memo`, только `useCallback`, обе вместе — и посчитайте число рендеров `Row` при вводе и при выборе строки.

```jsx
function App({ items }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  return (
    <div>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <ul>
        {items.map((i) => (
          <Row key={i.id} item={i} onSelect={(id) => setSelected(id)} />
        ))}
      </ul>
      <p>{selected}</p>
    </div>
  );
}
```

### Задание 3. Компаратор, который ломает интерфейс

Найдите ошибку и исправьте:

```jsx
const Row = memo(
  function Row({ user }) { return <li>{user.name} ({user.age})</li>; },
  (prev, next) => prev.user.id === next.user.id
);
```

### Задание 4. Решить структурой, а не memo

Любое нажатие в поле цвета перерисовывает тяжёлый `<Chart />`. Не используя `memo`, исправьте двумя способами: (а) опустить состояние вниз, (б) передать `Chart` как `children`.

```jsx
function Dashboard() {
  const [color, setColor] = useState("red");
  return (
    <div style={{ color }}>
      <input value={color} onChange={(e) => setColor(e.target.value)} />
      <Chart />
    </div>
  );
}
```

### Задание 5. Нужна ли мемоизация?

Для каждого фрагмента скажите, оправдана ли мемоизация и почему.

```jsx
// а)
const total = useMemo(() => a + b, [a, b]);

// б)
const sorted = useMemo(() => [...items].sort(cmp), [items]);   // items — 20 000 элементов

// в)
const onClick = useCallback(() => setOpen(true), []);
return <button onClick={onClick}>Open</button>;                // <button> — не memo-компонент

// г)
const options = useMemo(() => ({ room: roomId }), [roomId]);
useEffect(() => { connect(options); }, [options]);

// д)
const data = useMemo(() => { fetch("/api").then(setX); return null; }, []);
```

### Задание 6. Измерить и закешировать

Напишите `List({ items, query })`, который фильтрует и сортирует массив. Покажите счётчиком вызовов, что при несвязанном обновлении (клик по кнопке в том же компоненте) фильтрация не выполняется повторно, а при смене `query` выполняется ровно один раз. Как оценить, нужен ли здесь `useMemo` вообще?

### Задание 7. React Compiler

1. Что сделает компилятор с родителем из задания 2 без `useCallback` и без `memo` у `Row`?
2. Назовите два нарушения правил React, из-за которых компилятор не сможет безопасно оптимизировать компонент.
3. Как отключить оптимизацию для одного компонента?
