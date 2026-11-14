## Задания на закрепление

Все задания удобно проверять командой `npx tsc --noEmit` в проекте с `strict: true` и `jsx: "react-jsx"`.

### Задание 1. Типизированная кнопка

Сделайте `Button`: принимает все нативные атрибуты `<button>`, но не даёт менять `type` (всегда `"button"`); имеет `variant: "primary" | "danger"`, `size: "sm" | "lg"`, флаг `loading` (блокирует кнопку и показывает «…»). Убедитесь, что `<Button variant="secondary" />` и `<Button type="submit" />` не компилируются.

### Задание 2. Исправить ошибки типов

Исправьте каждую ошибку, не используя `any` и `as`:

```tsx
// а)
const [user, setUser] = useState(null);
setUser({ id: 1, name: "Ann" });

// б)
const ref = useRef<HTMLInputElement>(null);
ref.current.focus();

// в)
const [items, setItems] = useState([]);
setItems([1, 2, 3]);

// г)
const Card: FC<{ title: string }> = ({ title, children }) => <section>{children}</section>;

// д)
function Title(): JSX.Element { return <h1 />; }
```

### Задание 3. Generic Select

Сделайте компонент `Select<T>`: `options: T[]`, `value: T`, `onChange: (value: T) => void`, `getLabel`, необязательный `getKey`. Он должен работать и со строками, и с объектами (например, `City`). Тип `T` должен выводиться автоматически.

### Задание 4. Состояние запроса как union

Опишите `AsyncState<T>` (загрузка / ошибка / успех) и компонент `View<T>`, который принимает состояние и функцию `render(data)`. Убедитесь, что `data` недоступен вне ветки `success`, а состояние `success` без `data` не компилируется.

### Задание 5. Редьюсер с проверкой полноты

Типизируйте редьюсер задач (`add`, `toggle`, `remove`) дискриминируемым union. Добавьте проверку полноты через `never`, чтобы при добавлении нового действия компилятор требовал обработать его.

### Задание 6. Типобезопасный useFetch

Напишите `useFetch<T>(url, isT)`, который возвращает `AsyncState<T>` и принимает type guard `isT`. Почему нельзя просто написать `return res.json() as Promise<T>`?

### Задание 7. Generic-хук и контекст

Напишите `useLocalStorage<T>(key, initial)` с возвратом кортежа (`readonly [T, Dispatch<SetStateAction<T>>]`) и `ThemeProvider` с хуком `useTheme()`, не возвращающим `null`.

### Задание 8. Устно

1. Нужен ли `React.FC`? Что изменилось с `children`?
2. Чем `ReactNode` отличается от `ReactElement`?
3. Почему тип, полученный через `as User` от ответа `fetch`, ничего не гарантирует?
