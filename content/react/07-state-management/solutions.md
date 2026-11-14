## Решения

### Задание 1

Перерисуется только **`Consumer`**: он читает контекст, а `value` изменился (`n` другой, объект новый). `Plain` и `PlainMemo` созданы в `App`, а `App` не перерисовывался — React получает те же объекты элементов и пропускает их. Проверено: лог `['Consumer']`.

Если `Plain` и `PlainMemo` создавать внутри `Provider` (в его теле), то при изменении `n` перерисовывается `Provider`, а вместе с ним `Plain`; `PlainMemo` пропустит рендер, потому что у него нет пропсов (то же поведение `memo` проверено в теме про мемоизацию).

### Задание 2

Исходная проблема: объект `value` — новый на каждый рендер провайдера, а `user` и `theme` лежат в одном контексте, поэтому смена темы перерисовывает всех потребителей.

```jsx
// 1. useMemo — убирает лишние рендеры при перерисовке провайдера из-за родителя,
//    но потребители user всё равно рендерятся при смене theme (value реально изменился)
const value = useMemo(() => ({ user, theme, setTheme }), [user, theme]);

// 2. Раздельные контексты — потребители user не зависят от theme
const UserCtx = createContext(null);
const ThemeCtx = createContext(null);
function AppProvider({ children }) {
  const [user] = useState({ name: "Ann" });
  const [theme, setTheme] = useState("light");
  const themeValue = useMemo(() => ({ theme, setTheme }), [theme]);
  return (
    <UserCtx.Provider value={user}>
      <ThemeCtx.Provider value={themeValue}>{children}</ThemeCtx.Provider>
    </UserCtx.Provider>
  );
}

// 3. Значение и dispatch отдельно (с useReducer): компоненты, которым нужны только действия,
//    вообще не перерисовываются при изменении состояния — dispatch стабилен
```

Что проверено запуском: `value={{...}}` заставляет потребителя в `memo` перерисовываться при перерисовке провайдера, `useMemo` — нет; потребитель, читавший только `a` из общего контекста `{a, b}`, перерисовывался при смене `b`, а после разделения на два контекста — нет.

### Задание 3

```jsx
const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState("light");
  const value = useMemo(
    () => ({ theme, toggle: () => setTheme((t) => (t === "light" ? "dark" : "light")) }),
    [theme]
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (ctx === null) throw new Error("useTheme должен использоваться внутри <ThemeProvider>");
  return ctx;
}
```

`createContext(null)` позволяет отличить «нет провайдера» от значения.

### Задание 4

```jsx
function createStore(initial) {
  let state = initial;
  const listeners = new Set();
  return {
    getState: () => state,
    setState: (patch) => {
      state = { ...state, ...(typeof patch === "function" ? patch(state) : patch) };
      listeners.forEach((l) => l());
    },
    subscribe: (l) => { listeners.add(l); return () => listeners.delete(l); },
  };
}

const store = createStore({ count: 0, name: "ann" });
const useStore = (selector) =>
  useSyncExternalStore(store.subscribe, () => selector(store.getState()));

const Count = () => { const c = useStore((s) => s.count); console.log("Count"); return <i>{c}</i>; };
const Name = () => { const n = useStore((s) => s.name); console.log("Name"); return <b>{n}</b>; };
```

Проверено: после `setState(s => ({ count: s.count + 1 }))` рендерится только `Count`, после `setState({ name: "bob" })` — только `Name`.

Селектор `(s) => ({ c: s.count })` при каждом вызове возвращает **новый объект**, а `useSyncExternalStore` требует, чтобы снимок оставался тем же, пока данные не менялись. React видит «изменение» постоянно и уходит в цикл; проверено: «Maximum update depth exceeded». Решения: выбирать примитивы по отдельности, использовать мемоизирующий селектор или (в Zustand) `useShallow`.

### Задание 5

1. **Локальный `useState`** — состояние одного компонента.
2. **TanStack Query** — серверные данные: кэш, перезапрос, инвалидация.
3. **Context** — редко меняется, нужна многим. (Альтернатива: стор.)
4. **URL** (`searchParams`) — состояние должно быть частью ссылки и переживать перезагрузку.
5. **Внешний стор** (Zustand/Redux) или Context + reducer: общее клиентское состояние, читаемое из разных частей приложения и меняющееся достаточно часто, чтобы Context стал неудобен.
6. **Локальный `useState`** — состояние поля; в стор оно попадёт только после отправки (если вообще нужно).

### Задание 6

```jsx
function Todos() {
  const qc = useQueryClient();
  const { data: todos = [], isPending, error } = useQuery({
    queryKey: ["todos"],
    queryFn: () => fetch("/api/todos").then((r) => {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    }),
  });
  const add = useMutation({
    mutationFn: (title) =>
      fetch("/api/todos", { method: "POST", body: JSON.stringify({ title }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["todos"] }),
  });
  // add.mutate(title); isPending / error обрабатываются автоматически
}
```

(Нужен `QueryClientProvider` на верхнем уровне.) Проверено на имитации API: два компонента с одним `queryKey ["todos"]` выполнили **один** запрос и получили одни данные, после мутации и `invalidateQueries` данные обновились в обоих (всего два запроса).

### Задание 7

1. Context переносит значение вниз по дереву; у него нет селекторов (все потребители обновляются при изменении `value`), middleware и инструментов отладки. Стор хранит состояние и даёт подписку на срез.
2. Объект создаётся заново при каждом рендере провайдера, и потребители перерисовываются, даже если данные не изменились. Нужен `useMemo` либо разделение контекстов.
3. Большое приложение и команда, где нужны единые соглашения, строгая модель действий, middleware, трассировка в DevTools и RTK Query; Zustand предпочтителен для небольших и средних приложений с простой моделью.
