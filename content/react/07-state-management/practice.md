## Задания на закрепление

### Задание 1. Кто перерисуется?

```jsx
const Ctx = createContext(null);

function Provider({ children }) {
  const [n, setN] = useState(0);
  return (
    <Ctx.Provider value={{ user: "ann", n }}>
      <button onClick={() => setN(n + 1)}>{n}</button>
      {children}
    </Ctx.Provider>
  );
}

const Consumer = () => { const { user } = useContext(Ctx); return <i>{user}</i>; };
const Plain = () => <i>plain</i>;
const PlainMemo = memo(() => <i>memo</i>);

function App() {
  return <Provider><Consumer /><Plain /><PlainMemo /></Provider>;
}
```

После клика по кнопке: какие компоненты перерисуются и почему? Что изменится, если `Plain` и `PlainMemo` создавать **внутри** `Provider`, а не передавать как `children`?

### Задание 2. Починить производительность контекста

```jsx
const AppCtx = createContext(null);

function AppProvider({ children }) {
  const [user, setUser] = useState({ name: "Ann" });
  const [theme, setTheme] = useState("light");
  return (
    <AppCtx.Provider value={{ user, theme, setTheme }}>
      {children}
    </AppCtx.Provider>
  );
}
```

Компоненты, которым нужен только `user`, перерисовываются при смене темы. Исправьте тремя способами: `useMemo`, раздельные контексты, разделение «значение / dispatch». Что даёт каждый?

### Задание 3. Контекст темы с защитой

Сделайте `ThemeProvider` и хук `useTheme()`, который выбрасывает понятную ошибку при использовании вне провайдера. Добавьте переключение темы.

### Задание 4. Мини-стор

Реализуйте без библиотек `createStore(initial)` с `getState`, `setState`, `subscribe` и хук `useStore(selector)` на `useSyncExternalStore`. Покажите, что компонент, выбравший `count`, не рендерится при изменении `name`. Почему селектор `(s) => ({ c: s.count })` ломает компонент?

### Задание 5. Куда положить состояние?

Для каждого случая выберите: локальный `useState`, Context, внешний стор (Zustand/Redux), TanStack Query, URL — и объясните:

1. Открыт ли выпадающий список в шапке.
2. Список заказов пользователя.
3. Текущая тема оформления.
4. Страница и сортировка в таблице (чтобы можно было поделиться ссылкой).
5. Корзина покупок, которую читают шапка, страница товара и корзина.
6. Текст в поле поиска до отправки.

### Задание 6. От useEffect к useQuery

Перепишите на TanStack Query: список задач и добавление задачи с обновлением списка после успеха.

```jsx
function Todos() {
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/todos").then((r) => r.json()).then((d) => { setTodos(d); setLoading(false); });
  }, []);
  async function add(title) {
    await fetch("/api/todos", { method: "POST", body: JSON.stringify({ title }) });
    const r = await fetch("/api/todos");
    setTodos(await r.json());
  }
  // ...
}
```

Что произойдёт, если два компонента используют один `queryKey`?

### Задание 7. Устно

1. Чем Context отличается от стора?
2. Почему `value={{ a, b }}` в провайдере — плохая привычка?
3. Когда выбрать Redux Toolkit, а не Zustand?
