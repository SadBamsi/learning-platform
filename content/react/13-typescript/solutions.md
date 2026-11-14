## Решения

Весь код в решениях 1, 3–7 проверен компилятором TypeScript (`strict: true`, `jsx: react-jsx`, типы `@types/react` 19): ошибок нет; неверные использования, указанные в заданиях, дают ошибки.

### Задание 1

```tsx
type ButtonProps = Omit<ComponentProps<"button">, "type"> & {
  variant?: "primary" | "danger";
  size?: "sm" | "lg";
  loading?: boolean;
};

export function Button({
  variant = "primary", size = "sm", loading = false, children, disabled, ...rest
}: ButtonProps) {
  return (
    <button type="button" className={`${variant} ${size}`} disabled={disabled || loading} {...rest}>
      {loading ? "…" : children}
    </button>
  );
}
```

`<Button variant="secondary">` — ошибка (допустимы `"danger" | "primary"`), `<Button type="submit">` — ошибка (проп `type` исключён через `Omit`). `onClick={(e) => e.currentTarget.blur()}` типизирован автоматически: `e` — `MouseEvent<HTMLButtonElement>`.

### Задание 2

```tsx
// а) указать тип
const [user, setUser] = useState<{ id: number; name: string } | null>(null);

// б) проверка на null
const ref = useRef<HTMLInputElement>(null);
ref.current?.focus();

// в) указать тип элементов
const [items, setItems] = useState<number[]>([]);

// г) не использовать FC для children: типизировать пропсы напрямую
function Card({ children }: { title: string; children: ReactNode }) {
  return <section>{children}</section>;
}

// д) React.JSX.Element, ReactElement или вывод типа
function Title(): React.JSX.Element { return <h1 />; }
```

Подтверждено компилятором: (а) без дженерика `setU({ id: 1 })` — ошибка; (б) без `?.` — «possibly null»; (в) `useState([])` даёт `never[]`; (г) `FC` не содержит `children`; (д) глобального `JSX` нет.

### Задание 3

```tsx
type SelectProps<T> = {
  options: T[];
  value: T;
  onChange: (value: T) => void;
  getLabel: (option: T) => string;
  getKey?: (option: T) => string | number;
};

export function Select<T>({ options, value, onChange, getLabel, getKey = getLabel }: SelectProps<T>) {
  return (
    <select
      value={String(getKey(value))}
      onChange={(e) => {
        const next = options.find((o) => String(getKey(o)) === e.target.value);
        if (next !== undefined) onChange(next);
      }}
    >
      {options.map((o) => (
        <option key={getKey(o)} value={String(getKey(o))}>{getLabel(o)}</option>
      ))}
    </select>
  );
}

// использование: T = City выводится из options
<Select options={cities} value={city} onChange={setCity} getLabel={(c) => c.name} getKey={(c) => c.id} />
```

`<Select options={[1, 2]} value={1} onChange={(v: string) => v} … />` — ошибка: `T = number`, а колбэк принимает `string`.

### Задание 4

```tsx
type AsyncState<T> =
  | { status: "loading" }
  | { status: "error"; error: Error }
  | { status: "success"; data: T };

export function View<T>({ state, render }: { state: AsyncState<T>; render: (data: T) => ReactNode }) {
  switch (state.status) {
    case "loading": return <p>Загрузка…</p>;
    case "error": return <p role="alert">{state.error.message}</p>;
    case "success": return <>{render(state.data)}</>;
  }
}
```

Состояние `{ status: "success" }` без `data` не компилируется; `render={(d) => d.toUpperCase()}` при `data: 1` — ошибка (`d` — `number`). Внутри `case "success"` доступно `state.data`, в других ветках — нет.

### Задание 5

```tsx
type Todo = { id: number; title: string; done: boolean };
type TodoAction =
  | { type: "add"; title: string }
  | { type: "toggle"; id: number }
  | { type: "remove"; id: number };

function assertNever(x: never): never {
  throw new Error("Unhandled: " + JSON.stringify(x));
}

export function todoReducer(state: Todo[], action: TodoAction): Todo[] {
  switch (action.type) {
    case "add": return [...state, { id: state.length + 1, title: action.title, done: false }];
    case "toggle": return state.map((t) => (t.id === action.id ? { ...t, done: !t.done } : t));
    case "remove": return state.filter((t) => t.id !== action.id);
    default: return assertNever(action);
  }
}
```

Если добавить действие `{ type: "clear" }` и не обработать его в `switch`, `assertNever(action)` даёт ошибку «Argument of type '{ type: "clear" }' is not assignable to parameter of type 'never'» (проверено на аналогичном примере). В примере `id: state.length + 1` упрощён: после удаления он может дублироваться; в реальном коде используйте `crypto.randomUUID()`.

### Задание 6

```tsx
export function useFetch<T>(url: string, isT: (x: unknown) => x is T): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ status: "loading" });

  useEffect(() => {
    const ac = new AbortController();
    setState({ status: "loading" });
    fetch(url, { signal: ac.signal })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<unknown>;
      })
      .then((data) => {
        if (!isT(data)) throw new Error("Неверный формат ответа");
        setState({ status: "success", data });
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setState({ status: "error", error: e instanceof Error ? e : new Error(String(e)) });
      });
    return () => ac.abort();
  }, [url, isT]);

  return state;
}

const isCity = (x: unknown): x is City =>
  typeof x === "object" && x !== null &&
  typeof (x as City).id === "number" && typeof (x as City).name === "string";
```

`as Promise<T>` ничего не проверяет: TypeScript лишь «поверит» вам, а при другом формате ответа ошибка возникнет позже, внутри компонента. Type guard (или схема `zod`) проверяет данные в рантайме. Важно: функция `isT` должна быть стабильной (объявлена вне компонента), иначе эффект будет перезапускаться на каждом рендере. Код проходит компиляцию; в браузере/сети здесь не запускался.

### Задание 7

```tsx
export function useLocalStorage<T>(key: string, initial: T): readonly [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* квота */ }
  }, [key, value]);
  return [value, setValue] as const;
}

type Theme = "light" | "dark";
type ThemeCtxValue = { theme: Theme; toggle: () => void };
const ThemeCtx = createContext<ThemeCtxValue | null>(null);

export function useTheme(): ThemeCtxValue {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useTheme вне ThemeProvider");
  return ctx;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useLocalStorage<Theme>("theme", "light");
  return (
    <ThemeCtx.Provider value={{ theme, toggle: () => setTheme((t) => (t === "light" ? "dark" : "light")) }}>
      {children}
    </ThemeCtx.Provider>
  );
}
```

Замечание: `JSON.parse(raw) as T` — осознанное допущение для собственных данных; для внешних данных нужна валидация. Значение контекста в примере создаётся заново на каждый рендер (оптимизация — в теме про state management).

### Задание 8

1. Не обязателен: достаточно типизировать параметр пропсов. В актуальных типах `FC` не добавляет `children` (проверено), поэтому `children` объявляют явно (`ReactNode`).
2. `ReactNode` — всё, что можно отрендерить (строки, числа, элементы, массивы, `null`, `false`). `ReactElement` — только объект React-элемента.
3. `as` лишь заставляет компилятор поверить; типы стираются при компиляции, и рантайм-проверки нет. Если сервер вернёт другой формат, ошибка проявится позже. Нужны type guard или схема (`zod`).
