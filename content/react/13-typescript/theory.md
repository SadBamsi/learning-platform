> **Ответ за 30 секунд.** TypeScript в React описывает **контракты компонентов**: типы `props`, состояния, событий и контекста, а компилятор ловит ошибки до запуска. Пропсы задают через `type`/`interface`, содержимое — `children: ReactNode`; события — `ChangeEvent<HTMLInputElement>`, `MouseEvent<HTMLButtonElement>`; нативные атрибуты расширяют через `ComponentProps<"button">`. Хуки типизируют дженериками: `useState<User | null>(null)`, `useRef<HTMLInputElement>(null)`, `useReducer` с union-типом действий, `createContext<Ctx | null>(null)` + хук с проверкой. Взаимоисключающие наборы пропсов описывают **дискриминируемыми объединениями**; универсальные компоненты — **дженериками**. `React.FC` не обязателен (и в современных типах не добавляет `children`). Типы существуют только на этапе компиляции: данные от API проверяют в рантайме (`zod`, type guards), а `any` и `as` для «затыкания» ошибок — запах кода.

## Что именно спрашивают

- «Как типизировать пропсы и `children`? Нужен ли `React.FC`?»
- «Как типизировать события `onChange`, `onSubmit`, `onClick`?»
- «Как типизировать `useState`, `useRef`, `useReducer`, `useContext`?»
- «Как сделать generic-компонент (список, таблица, select)?»
- «Как описать пропсы, где одни поля зависят от других (union)?»
- «Как расширить пропсы нативного элемента?»
- «Чем `interface` отличается от `type` для пропсов?»
- «Почему нельзя доверять типам для данных с сервера?»

## Пропсы и children

```tsx
type CardProps = {
  title: string;
  children: ReactNode;                // что угодно, что React умеет рендерить
  onClose?: () => void;               // необязательный колбэк
  size?: "sm" | "lg";                 // литеральный union вместо string
};

function Card({ title, children, onClose, size = "sm" }: CardProps) { /* ... */ }
```

Проверено компилятором (`tsc` strict): `<Card><b>x</b></Card>` без обязательного `title` — ошибка TS2741; значение `size="xl"` — ошибка (допустимы только `"sm" | "lg"`).

- **`ReactNode`** — любой допустимый «ребёнок» (строка, число, элемент, массив, `null`, `false`); **`ReactElement`** — только React-элемент; для функции-ребёнка (render prop) — `(item: T) => ReactNode`.
- **`type` или `interface`:** для пропсов практически равнозначны. `type` удобнее для union и пересечений; `interface` расширяется через `extends`. Главное — единообразие в проекте.
- **Деструктуризация с дефолтами** (`size = "sm"`) вместо `defaultProps`.

### React.FC: нужен ли

`const A: FC<{ a: number }> = ({ children }) => ...` — **ошибка**: в актуальных типах `FC` не добавляет `children` (проверено). Поэтому достаточно аннотировать пропсы параметра: `function A({ a }: { a: number }) {}`. Минусы `FC`: неудобно с дженериками, лишняя обёртка типа. Это стилистический выбор.

### JSX.Element и React.JSX

В типах для React 19 глобального пространства `JSX` **нет**: `function B(): JSX.Element` даёт ошибку «Cannot find namespace 'JSX'» (проверено). Варианты: `React.JSX.Element`, `ReactElement`, либо не указывать тип возврата (TypeScript выведет сам).

## Нативные атрибуты и ref

```tsx
type InputProps = ComponentProps<"input"> & { label: string };

function Field({ label, ...rest }: InputProps) {
  return <label>{label}<input {...rest} /></label>;
}
// <Field label="Имя" placeholder="..." onChange={(e) => e.target.value} />
```

`ComponentProps<"input">` содержит все атрибуты `<input>` (включая `onChange` с правильным типом события), а в типах React 19 — и **`ref`**: поэтому `function MyInput({ ref, ...props }: ComponentProps<"input">)` компилируется без `forwardRef` (проверено).

Если нужно **переопределить** нативный проп: `Omit<ComponentProps<"input">, "onChange"> & { onChange: (value: string) => void }` — компонент отдаёт строку, а не событие (проверено).

`ComponentProps<typeof MyComponent>` достаёт пропсы существующего компонента.

## События

```tsx
const onChange = (e: ChangeEvent<HTMLInputElement>) => setValue(e.target.value);
const onSubmit = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); /* ... */ };
const onClick = (e: MouseEvent<HTMLButtonElement>) => { /* ... */ };
const onSelect: ChangeEventHandler<HTMLSelectElement> = (e) => setKind(e.target.value);
```

Тип события зависит от элемента: `HTMLInputElement`, `HTMLSelectElement`, `HTMLTextAreaElement`. Если неудобно писать типы вручную, обработчик можно записать прямо в JSX — контекст подскажет тип (`onChange={(e) => ...}`). Попытка повесить обработчик не того типа (`(e: MouseEvent) => {}` на `onChange`) — ошибка (проверено).

## Хуки

**useState.** Если начальное значение не раскрывает тип, указывайте дженерик:

```tsx
const [user, setUser] = useState<User | null>(null);
const [items, setItems] = useState<Item[]>([]);          // без <Item[]> будет never[]
const [u] = useState<User>();                            // тип User | undefined
```

Проверено: `useState([])` выводит `never[]`, и `setL([1])` — ошибка; `useState<User>()` даёт `User | undefined`, обращение `u.n` требует проверки.

Передача `setState` в пропсы: `Dispatch<SetStateAction<number>>` (проверено).

**useRef.** Для DOM — `useRef<HTMLInputElement>(null)`; `ref.current` имеет тип `... | null`, обращение без проверки — ошибка (`ref.current?.focus()`; проверено). В типах React 19 у `useRef` обязателен аргумент (`useRef<number>()` — ошибка, нужно `useRef<number>(0)` или `useRef<number | undefined>(undefined)`). Для хранения таймера: `useRef<ReturnType<typeof setTimeout> | null>(null)`.

**useReducer** — типизируйте действия дискриминируемым объединением, и `switch` проверит полноту:

```tsx
type Action = { type: "inc" } | { type: "add"; by: number } | { type: "reset" };

function reducer(state: number, action: Action): number {
  switch (action.type) {
    case "inc": return state + 1;
    case "add": return state + action.by;           // тут action.by существует
    case "reset": return 0;
  }
}
```

**useContext.** Контекст без значения по умолчанию типизируют как `Ctx | null` и скрывают проверку в хуке:

```tsx
const ThemeCtx = createContext<Theme | null>(null);

function useTheme(): Theme {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useTheme вне ThemeProvider");
  return ctx;                                       // тип Theme, без null
}
```

**Кастомные хуки** возвращают кортеж с `as const`, чтобы не получить union-массив: `return [value, setValue] as const;`.

## Дискриминируемые union для пропсов

Когда набор пропсов зависит от режима:

```tsx
type AlertProps =
  | { kind: "success"; message: string }
  | { kind: "error"; error: Error };

function Alert(p: AlertProps) {
  return p.kind === "success" ? <b>{p.message}</b> : <i>{p.error.message}</i>;
}
```

Внутри ветки TypeScript сужает тип: в `"success"` доступен `message`, в `"error"` — `error`. Обращение к `p.message` без сужения — ошибка (проверено). Нельзя передать `<Alert kind="error" message="..." />` — пропса `message` нет в этой ветке.

## Generic-компоненты

```tsx
type ListProps<T> = {
  items: T[];
  getKey: (item: T) => string | number;
  render: (item: T) => ReactNode;
};

function List<T>({ items, getKey, render }: ListProps<T>) {
  return <ul>{items.map((i) => <li key={getKey(i)}>{render(i)}</li>)}</ul>;
}

<List items={[{ id: 1, n: "a" }]} getKey={(x) => x.id} render={(x) => x.n} />   // T выводится автоматически
```

Проверено: тип `T` выводится из `items`, параметры колбэков типизированы. Так делают таблицы, селекты, виртуализированные списки.

## Utility-типы и вспомогательные приёмы

- `Pick`, `Omit`, `Partial`, `Required`, `Record`, `ReturnType`, `Awaited`.
- **`as const`** — сужает литералы: `const ROUTES = { home: "/" } as const; type Route = (typeof ROUTES)[keyof typeof ROUTES];`.
- **`satisfies`** — проверяет соответствие типу без расширения выведенного типа.
- **`unknown` вместо `any`** для внешних данных: заставляет проверять перед использованием.

## Типы — не рантайм

Типы стираются при компиляции. `const data = (await res.json()) as User` — это **ложное обещание**: если сервер вернул другое, ошибка будет в рантайме. Правильнее:

```tsx
const data: unknown = await res.json();
// ошибка: data.name — «'data' is of type 'unknown'» (проверено)

const isUser = (x: unknown): x is User =>
  typeof x === "object" && x !== null && "name" in x && typeof (x as User).name === "string";

if (isUser(data)) { data.name; }                       // сужение через type guard
```

На практике используют схемы (`zod`, `valibot`): одна схема даёт и рантайм-проверку, и выведенный тип (`z.infer<typeof Schema>`). В fullstack-проектах общие типы/схемы вынесены в общий пакет между клиентом и сервером.

## Частые follow-up вопросы

**`interface` или `type` для пропсов?**
Оба подходят; `type` лучше для union, `interface` — для расширения и слияния деклараций. Следуйте соглашению проекта.

**Как типизировать `children`, если нужен только текст?**
`children: string`. Если нужен ровно один элемент — `ReactElement`.

**Как типизировать полиморфный компонент (`as="a"`)?**
Дженериком по тегу и `ComponentPropsWithoutRef<T>`; это сложный паттерн, проще использовать готовые решения (Radix `asChild`).

**`any` или `unknown`?**
`unknown`: безопасный «верхний» тип, требует сужения. `any` отключает проверку.

**Зачем `as const`?**
Чтобы получить литеральные типы и кортежи вместо расширенных (`string`, `(A | B)[]`).

**Что даёт `strict: true`?**
Включает строгую проверку `null`/`undefined`, `noImplicitAny` и др.; без него многие ошибки пропускаются.

## Типичные ошибки

- `useState([])` без дженерика (получаете `never[]`).
- `as User` для ответа API вместо валидации.
- Неотфильтрованный `!` (non-null assertion) и `any` для «заглушки».
- Обращение к `ref.current` без проверки на `null`.
- `JSX.Element` в проектах на React 19 типах.
- Булевы флаги вместо union-пропсов (допускают невозможные комбинации).
- Сложные условные типы там, где хватило бы дженерика или перегрузки.
