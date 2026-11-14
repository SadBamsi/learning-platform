> **Ответ за 30 секунд.** Главный механизм переиспользования в React — **композиция**: компоненты принимают другие компоненты и элементы через `children` и пропсы, а повторяющуюся **логику с состоянием** выносят в **кастомные хуки** (функции `useXxx`, внутри которых вызываются другие хуки). Каждый вызов кастомного хука создаёт **собственное** состояние. Для набора связанных компонентов (`Tabs`, `Tabs.Tab`, `Tabs.Panel`) используют **compound components** на Context. Компонент, который можно использовать и «управляемым» (значение приходит пропсом), и «неуправляемым» (хранит значение сам), строят через `useControllableState`. **HOC** и **render props** — старые способы повторного использования логики; в новом коде их в основном заменяют хуки (HOC остаются в некоторых библиотеках и для оборачивания на уровне маршрутов). Не нужно выделять хук «на всякий случай»: выделяйте, когда логика повторяется или заметно усложняет компонент.

## Что именно спрашивают

- «Что такое кастомный хук? Как его написать? Делят ли два компонента его состояние?»
- «Какие паттерны переиспользования логики вы знаете: HOC, render props, хуки? Чем хуки лучше?»
- «Что такое compound components? Приведите пример».
- «Controlled и uncontrolled компоненты: в чём разница?»
- «Что такое композиция против наследования?»
- «Как избежать «флагового» API (`<Button primary large danger />`)?»

## Кастомные хуки

Кастомный хук — обычная функция, имя которой начинается с `use` и которая вызывает другие хуки. Она **не** делится состоянием между вызовами (см. тему про хуки): каждый компонент получает свою копию.

```jsx
function useLocalStorage(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }, [key, value]);

  return [value, setValue];
}
```

Проверено: значение читается при первом рендере, записывается при изменении, и новый экземпляр компонента читает сохранённое (`5 → 6`).

**Рекомендации по дизайну хуков:**

- **Один хук — одна ответственность.** Лучше `useDebounce`, `useLocalStorage`, `useEventListener`, чем «универсальный» `useEverything`.
- **Что возвращать:** кортеж `[value, setValue]` удобен, если пользователь переименовывает значения; объект — когда значений много или они опциональны.
- **Стабильные ссылки.** Если хук возвращает функции, которые попадут в зависимости или в `memo`-пропсы, оборачивайте их в `useCallback`; нестабильный возвращаемый объект часто становится причиной лишних эффектов.
- **Принимать актуальный колбэк через `ref`**, а не пересоздавать подписку (паттерн ниже).
- **Не прятать побочные эффекты в неожиданных местах:** имя должно отражать поведение (`useOnlineStatus`, `useDocumentTitle`).
- **Тестируйте** через `renderHook` из React Testing Library или опосредованно, через компонент.

**SSR:** `localStorage` отсутствует на сервере. Чтение в инициализаторе (как выше) в Next.js приведёт к ошибке на сервере или несовпадению HTML при гидратации. Решения: читать в эффекте, защищать `typeof window !== "undefined"` и учитывать ошибку гидратации, либо использовать `useSyncExternalStore` с `getServerSnapshot`:

```jsx
function useLocalStorageValue(key, fallback = null) {
  const subscribe = useCallback((cb) => {
    const h = (e) => { if (e.key === key || e.key === null) cb(); };
    window.addEventListener("storage", h);                    // события из других вкладок
    return () => window.removeEventListener("storage", h);
  }, [key]);
  const raw = useSyncExternalStore(subscribe, () => localStorage.getItem(key), () => null);
  return raw === null ? fallback : JSON.parse(raw);
}
```

Проверено: после записи в `localStorage` и события `storage` компонент показал новое значение (`light → dark`).

### Хук с актуальным обработчиком

```jsx
function useEventListener(type, handler) {
  const saved = useRef(handler);
  useEffect(() => { saved.current = handler; });          // всегда свежий обработчик

  useEffect(() => {
    const listener = (e) => saved.current(e);
    window.addEventListener(type, listener);
    return () => window.removeEventListener(type, listener);
  }, [type]);                                              // подписка создаётся один раз
}
```

Проверено: за три нажатия клавиши обработчик увидел значения `[0, 1, 2]` (то есть не «залип» на устаревшем состоянии), слушатель добавлен 1 раз и удалён при размонтировании.

## Композиция

React предпочитает **композицию наследованию**: компонент не расширяют классом-родителем, а собирают из других.

- **`children`** — «дырка» для произвольного содержимого: `<Card><Avatar /><Name /></Card>`.
- **Слоты через пропсы:** `<Layout header={<Header />} sidebar={<Nav />}>content</Layout>`.
- **Специализация:** `<ConfirmDialog>` = `<Dialog>` с конкретным содержимым, а не подкласс.
- **Контроль над рендерингом через функции:** `renderItem` (см. render props).

**Антипаттерн — «флаги» вместо композиции:**

```jsx
<Button primary large danger icon="trash" iconRight loading />
```

Пропсы множатся, комбинации противоречат друг другу. Лучше выделять варианты (`variant="danger" size="lg"`) и позволять компоновать содержимое: `<Button><Trash /> Удалить</Button>`.

## Compound components

Набор компонентов, которые работают вместе и **общаются через контекст**, а пользователь компонует их в нужном порядке:

```jsx
const TabsCtx = createContext(null);

function Tabs({ defaultValue, children }) {
  const [value, setValue] = useState(defaultValue);
  return <TabsCtx.Provider value={{ value, setValue }}><div>{children}</div></TabsCtx.Provider>;
}
Tabs.List = ({ children }) => <div role="tablist">{children}</div>;
Tabs.Tab = ({ value, children }) => {
  const c = useContext(TabsCtx);
  return <button role="tab" aria-selected={c.value === value} onClick={() => c.setValue(value)}>{children}</button>;
};
Tabs.Panel = ({ value, children }) => {
  const c = useContext(TabsCtx);
  return c.value === value ? <div role="tabpanel">{children}</div> : null;
};

// использование
<Tabs defaultValue="a">
  <Tabs.List><Tabs.Tab value="a">A</Tabs.Tab><Tabs.Tab value="b">B</Tabs.Tab></Tabs.List>
  <Tabs.Panel value="a">…</Tabs.Panel>
  <Tabs.Panel value="b">…</Tabs.Panel>
</Tabs>
```

Проверено: панель переключается, `aria-selected` обновляется. Плюсы: гибкая разметка (между элементами можно вставить что угодно), нет «пробрасывания» состояния. Так устроены библиотеки Radix UI, Headless UI, Reach UI. В `value` контекста нужно соблюдать правила (стабильный объект), иначе — лишние рендеры.

**Headless-компоненты** — то же самое без стилей: библиотека отдаёт логику и доступность, внешний вид ваш (Radix, Headless UI, TanStack Table, Downshift).

## Controlled и uncontrolled

- **Controlled (управляемый):** значение приходит из пропса, изменения сообщаются через `onChange`; источник правды — родитель.
- **Uncontrolled (неуправляемый):** компонент хранит состояние сам (для `<input>` — в DOM, читается через `ref`; у собственных компонентов — через внутренний `useState` и `defaultValue`).

Удобный компонент поддерживает оба режима:

```jsx
function useControllableState({ value, defaultValue, onChange }) {
  const [inner, setInner] = useState(defaultValue);
  const controlled = value !== undefined;
  const current = controlled ? value : inner;
  const set = useCallback((next) => {
    if (!controlled) setInner(next);
    onChange?.(next);
  }, [controlled, onChange]);
  return [current, set];
}
```

Проверено на `Toggle`: без пропса `on` — работает сам (`true` после клика); с `on={false}` без обновления родителем — остаётся `false`, `onChange` вызван с `true` (родитель «решает»); с родителем, хранящим состояние, — переключается.

Правило: не переключайте компонент между режимами на лету (значение `undefined` ↔ определённое) — React предупреждает об этом для `<input>`.

## HOC и render props

**HOC** (Higher-Order Component) — функция, принимающая компонент и возвращающая обёрнутый:

```jsx
const withLoading = (Comp) => function WithLoading({ loading, ...props }) {
  return loading ? <i>loading</i> : <Comp {...props} />;
};
const HelloWithLoading = withLoading(Hello);
```

**Render props** — компонент принимает функцию, которая возвращает JSX:

```jsx
<Mouse>{(pos) => <i>x={pos.x}</i>}</Mouse>
```

Оба варианта работают (проверено), но хуже хуков: HOC создаёт «обёрточный ад» и скрывает происхождение пропсов (возможны конфликты имён), теряет статические свойства и `ref` без дополнительной работы; render props даёт вложенность («callback hell» в JSX). Хук решает ту же задачу плоским вызовом: `const pos = useMouse()`. HOC сегодня встречаются в `connect` из react-redux (вместо него для нового кода рекомендуют хуки `useSelector`/`useDispatch`), в `React.memo` (функция, оборачивающая компонент) и в проверках доступа на уровне страниц.

## Частые follow-up вопросы

**Чем кастомный хук отличается от обычной функции?**
Он вызывает другие хуки, а значит, должен соблюдать правила хуков; имя начинается с `use`.

**Зачем разделять logic и UI?**
Логика в хуке тестируется отдельно и переиспользуется с разной разметкой; компонент остаётся декларативным описанием интерфейса.

**Как реализовать «слоты»?**
Передавать элементы через пропсы (`header`, `footer`) или `children`.

**Что лучше: HOC или хук?**
Хук, если логика нужна внутри компонента. HOC — когда нужно обернуть компонент целиком (например, защита маршрута) и нельзя менять его код.

**Почему не использовать наследование компонентов?**
Композиция гибче: поведение собирается из частей, а не прибито к иерархии классов; React не рекомендует наследование для UI.

## Типичные ошибки

- Ожидать, что два компонента с одним кастомным хуком делят состояние.
- «Монолитный» хук, который делает всё сразу.
- Нестабильный объект/функции в возврате хука → лишние эффекты и рендеры.
- Хук, который читает `localStorage`/`window` без учёта SSR.
- Флаги вместо композиции (`isPrimary`, `isLarge`, `isDanger`…).
- Переключение компонента между управляемым и неуправляемым режимами.
- Использование HOC там, где достаточно хука.
