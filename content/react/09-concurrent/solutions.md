## Решения

### Задание 1

Компонент `A` (переход), проверено запуском:

```
A a true       ← срочный проход: isPending = true, содержимое ещё старое
Slow a
A b false      ← переход применён
Slow b
```

Компонент `B` (`useDeferredValue`):

```
B abc ""       ← срочный проход: q уже новый, dq ещё старый
List ""        ← List без memo рендерится со старым dq
B abc abc      ← отложенный проход
List abc
```

Если обернуть `List` в `memo`, строка `List ""` исчезает: в срочном проходе пропсы не менялись, `memo` пропускает рендер (проверено: без `memo` — `['List ', 'List a']`, с `memo` — `['List a']`).

### Задание 2

```jsx
function Tabs() {
  const [tab, setTab] = useState("home");
  const [isPending, startTransition] = useTransition();

  function select(next) {
    startTransition(() => setTab(next));
  }

  return (
    <>
      {["home", "posts", "slow"].map((t) => (
        <button key={t} onClick={() => select(t)} aria-pressed={tab === t}>{t}</button>
      ))}
      <div style={{ opacity: isPending ? 0.6 : 1 }}>
        {tab === "home" && <Home />}
        {tab === "posts" && <Posts />}
        {tab === "slow" && <SlowTab />}
      </div>
    </>
  );
}
```

Пока готовится медленная вкладка, остаётся старое содержимое, а `isPending` позволяет его приглушить; кнопки реагируют сразу, потому что переход прерываем. Оговорка: если сама функция `SlowTab` рендерится очень долго и без разбиения, прервать её середину нельзя; тогда нужно дробить компонент или виртуализировать.

### Задание 3

```jsx
const HeavyList = memo(function HeavyList({ query, items }) {
  const filtered = useMemo(
    () => items.filter((i) => i.name.toLowerCase().includes(query.toLowerCase())),
    [items, query]
  );
  return <ul>{filtered.map((i) => <li key={i.id}>{i.name}</li>)}</ul>;
});

function Search({ items }) {
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  return (
    <>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <div style={{ opacity: query !== deferred ? 0.6 : 1 }}>
        <HeavyList query={deferred} items={items} />
      </div>
    </>
  );
}
```

`memo` нужен, потому что в срочном проходе `deferred` ещё старое: без `memo` список рендерился бы дважды (проверено), и выигрыша нет. В отличие от debounce, `useDeferredValue` не добавляет фиксированной задержки: на быстром устройстве отложенный проход выполняется сразу, а при новом вводе прерывается. Debounce нужен, когда требуется уменьшить число **запросов к серверу**; можно применять оба: debounce для запросов, `useDeferredValue` для плавного рендера результатов.

### Задание 4

```jsx
// (а) правильно: промисы кэшируются по id
const cache = new Map();
function fetchUser(id) {
  if (!cache.has(id)) {
    cache.set(id, fetch(`/api/users/${id}`).then((r) => r.json()));
  }
  return cache.get(id);
}

function User({ id }) {
  const user = use(fetchUser(id));
  return <b>{user.name}</b>;
}

function Page({ id }) {
  return (
    <Suspense fallback={<i>Загрузка…</i>}>
      <User id={id} />
    </Suspense>
  );
}

// (б) ошибка: новый промис на каждый рендер
function UserBad({ id }) {
  const user = use(fetch(`/api/users/${id}`).then((r) => r.json()));   // ✖
  return <b>{user.name}</b>;
}
```

Проверено на имитации (промис 20–40 мс): с кэшем сначала `fallback`, затем данные. В варианте (б) `fallback` не исчезает: каждый рендер создаёт новый промис, поэтому React не может связать ожидание с результатом. В production кэш обычно обеспечивает библиотека (TanStack Query, фреймворк); в Next.js промис создаётся в серверном компоненте и передаётся пропсом.

### Задание 5

```jsx
function Viewer() {
  const [id, setId] = useState(1);
  const [isPending, startTransition] = useTransition();

  return (
    <>
      <button onClick={() => startTransition(() => setId((x) => x + 1))}>Следующий</button>
      {isPending && <span>Загрузка…</span>}
      <Suspense fallback={<i>Скелетон</i>}>
        <User id={id} />
      </Suspense>
    </>
  );
}
```

Проверено на имитации: без перехода при смене `id` показывается `fallback`; в переходе остаётся `user-1`, `isPending` равен `true`, затем появляется `user-2`. Первый показ данных (когда ещё нечего удерживать) по-прежнему использует `fallback`.

### Задание 6

Значение управляемого поля обновляется внутри перехода, то есть **несрочно**. React может отложить это обновление (и прервать его при следующем нажатии), и поле «залипает»/теряет символы. Исправление: срочное состояние для значения поля, а несрочное — для результата:

```jsx
const [query, setQuery] = useState("");
const deferred = useDeferredValue(query);      // или отдельное состояние + startTransition
<input value={query} onChange={(e) => setQuery(e.target.value)} />
<Results query={deferred} />
```

### Задание 7

1. Нет: поток один, React лишь дробит работу и расставляет приоритеты, уступая управление браузеру.
2. Рендер перехода может быть прерван, отброшен и запущен заново; побочные эффекты в теле компонента выполнятся несколько раз или в неожиданный момент.
3. Если один компонент сам рендерится очень долго (прервать середину функции нельзя), если тяжёлая работа не связана с рендером (синхронный `JSON.parse` огромного файла) или проблема в сети; нужны другие средства: разбиение, виртуализация, Web Worker.
