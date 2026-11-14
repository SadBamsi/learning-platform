## Решения

### Задание 1

```jsx
function useToggle(initial = false) {
  const [open, setOpen] = useState(initial);
  const toggle = useCallback(() => setOpen((o) => !o), []);
  const close = useCallback(() => setOpen(false), []);
  return { open, toggle, close };
}

function Modal() { const { open, toggle, close } = useToggle(); /* ... */ }
function Menu()  { const { open, toggle, close } = useToggle(); /* ... */ }
```

Состояние **не разделяется**: каждый вызов хука создаёт собственное (проверено в теме про хуки: клик по одному счётчику не меняет второй). Для общего состояния нужен контекст или стор. Функции обёрнуты в `useCallback`, чтобы их можно было безопасно передавать в `memo`-потомков и зависимости.

### Задание 2

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

function useLocalStorageValue(key, fallback = null) {
  const subscribe = useCallback((cb) => {
    const h = (e) => { if (e.key === key || e.key === null) cb(); };
    window.addEventListener("storage", h);
    return () => window.removeEventListener("storage", h);
  }, [key]);
  const raw = useSyncExternalStore(subscribe, () => localStorage.getItem(key), () => null);
  return raw === null ? fallback : JSON.parse(raw);
}
```

Проверено: первый хук читает `5`, после клика пишет `6`, новый экземпляр читает `6`; второй хук после записи и события `storage` показал новое значение. (Событие `storage` приходит в **другие** вкладки; в той же вкладке его нужно вызывать вручную, как в проверке.)

SSR: на сервере `localStorage` отсутствует (`ReferenceError`), а значение, прочитанное на клиенте в первом рендере, отличается от серверного HTML — возникает ошибка гидратации. Поэтому для SSR используют `useSyncExternalStore` с `getServerSnapshot`, либо читают в эффекте (с кратким показом значения по умолчанию).

### Задание 3

```jsx
const TabsCtx = createContext(null);

function Tabs({ defaultValue, children }) {
  const [value, setValue] = useState(defaultValue);
  const ctx = useMemo(() => ({ value, setValue }), [value]);
  return <TabsCtx.Provider value={ctx}><div>{children}</div></TabsCtx.Provider>;
}
Tabs.List = ({ children }) => <div role="tablist">{children}</div>;
Tabs.Tab = ({ value, children }) => {
  const c = useContext(TabsCtx);
  return (
    <button role="tab" aria-selected={c.value === value} onClick={() => c.setValue(value)}>
      {children}
    </button>
  );
};
Tabs.Panel = ({ value, children }) => {
  const c = useContext(TabsCtx);
  return c.value === value ? <div role="tabpanel">{children}</div> : null;
};
```

Проверено: изначально виден `panel-a`, после клика по второй вкладке — `panel-b`, `aria-selected` равно `['false', 'true']`.

Преимущества перед массивом `tabs`: можно вставлять произвольные элементы между вкладками и менять разметку без новых пропсов; логика состояния спрятана, а структура описывается JSX. Недостаток — компоненты должны использоваться внутри `Tabs` (нужна проверка контекста).

### Задание 4

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

function Toggle({ on, defaultOn = false, onChange }) {
  const [v, set] = useControllableState({ value: on, defaultValue: defaultOn, onChange });
  return <button onClick={() => set(!v)}>{String(v)}</button>;
}
```

Предсказание и проверка: `<Toggle on={false} onChange={fn} />` без обновления родителем остаётся `false`; `fn` вызывается с `true`. Родитель решает, принять ли изменение. Неуправляемый режим переключается сам; управляемый с родителем (`useState` + `onChange={setOn}`) переключается через родителя.

### Задание 5

```jsx
function useEventListener(type, handler) {
  const saved = useRef(handler);
  useEffect(() => { saved.current = handler; });
  useEffect(() => {
    const listener = (e) => saved.current(e);
    window.addEventListener(type, listener);
    return () => window.removeEventListener(type, listener);
  }, [type]);
}
```

Проверено: три события дали значения `[0, 1, 2]`, слушатель добавлен один раз и удалён при размонтировании. Если подписку делать с `[handler]`, при каждом рендере (новая функция) слушатель будет сниматься и добавляться заново — лишняя работа и возможная потеря событий в момент переподписки. Если оставить `[]` и читать `state` напрямую, получится stale closure.

### Задание 6

```jsx
function useWindowWidth() {
  const [w, setW] = useState(() => window.innerWidth);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return w;
}

function Panel() {
  const width = useWindowWidth();
  return <p>{width}</p>;
}
```

Недостатки HOC: (1) компонент получает «неявные» пропсы — неочевидно, откуда они (`width`); (2) возможны конфликты имён пропсов при нескольких HOC; (3) вложенность обёрток («wrapper hell») в DevTools; (4) теряются статические свойства и `ref` без дополнительной работы; (5) типизация усложняется. В примере выше `window` недоступен на сервере — нужен защитный код или `useSyncExternalStore` (как в задании 2).

### Задание 7

```jsx
<Button variant="danger" size="lg" loading>
  <TrashIcon /> Удалить
</Button>

// иконка справа — просто порядок в children
<Button variant="primary">Далее <ArrowRight /></Button>
```

Вместо взаимоисключающих булевых флагов — перечисляемые пропсы (`variant`, `size`), а содержимое (иконки) составляется через `children`. Это убирает недопустимые комбинации (`primary` + `danger`) и позволяет ставить иконку куда угодно без дополнительных флагов.

### Задание 8

1. Набор компонентов, взаимодействующих через общий контекст и составляемых пользователем (`Tabs`/`Tabs.Tab`/`Tabs.Panel`, `Select`/`Select.Option`). Встречается в Radix UI, Headless UI, Reach UI.
2. Controlled: значение хранит родитель (пропс + `onChange`) — нужен, когда состояние нужно синхронизировать, валидировать или использовать в других местах. Uncontrolled: хранит компонент (или DOM) — проще для простых форм и сторонних интеграций; чтение через `ref`.
3. Хук — это плоский вызов без обёрток: нет вложенности, видно источник данных, проще типизировать и тестировать; HOC и render props вносят лишние уровни дерева и неявные пропсы.
