## Задания на закрепление

Задания 1 и 4 — «предскажи», сначала запишите ответ.

### Задание 1. Когда запускается эффект?

Что выведется в консоль при: монтировании `<Demo id={1} />`; повторном рендере с тем же `id`; смене на `id={2}`; размонтировании? Что изменится, если массив зависимостей заменить на `[]`? А если его убрать?

```jsx
function Demo({ id }) {
  useEffect(() => {
    console.log("effect", id);
    return () => console.log("cleanup", id);
  }, [id]);
  return null;
}
```

### Задание 2. Утечка слушателя

В режиме разработки (StrictMode) счётчик показывает, что слушателей `resize` на `window` больше, чем нужно, и после размонтирования они остаются. Найдите ошибку и исправьте. Как проверить исправление, не открывая DevTools?

```jsx
function WindowWidth() {
  const [w, setW] = useState(window.innerWidth);
  useEffect(() => {
    const onResize = () => setW(window.innerWidth);
    window.addEventListener("resize", onResize);
  }, []);
  return <p>{w}</p>;
}
```

### Задание 3. Гонка запросов

Строка поиска: при быстром вводе иногда показываются результаты для предыдущего запроса. Объясните причину и исправьте двумя способами: флагом и `AbortController`. Добавьте состояния `loading` и `error`.

```jsx
function Search({ query }) {
  const [results, setResults] = useState([]);
  useEffect(() => {
    fetch(`/api/search?q=${query}`).then((r) => r.json()).then(setResults);
  }, [query]);
  return <List items={results} />;
}
```

### Задание 4. Бесконечный цикл

Почему этот компонент зациклился и как это исправить минимум тремя способами?

```jsx
function Filtered({ items }) {
  const [list, setList] = useState([]);
  const filter = { active: true };
  useEffect(() => {
    setList(items.filter((i) => i.active === filter.active));
  }, [items, filter]);
  return <p>{list.length}</p>;
}
```

### Задание 5. Эффект не нужен

Перепишите без `useEffect`:

```jsx
// а) производное значение
const [fullName, setFullName] = useState("");
useEffect(() => { setFullName(first + " " + last); }, [first, last]);

// б) реакция на действие
const [submitted, setSubmitted] = useState(false);
useEffect(() => { if (submitted) { sendAnalytics("form_submitted"); } }, [submitted]);
function handleSubmit() { setSubmitted(true); }

// в) сброс при смене пропса
const [comment, setComment] = useState("");
useEffect(() => { setComment(""); }, [postId]);
```

### Задание 6. useDebounce

Напишите хук `useDebounce(value, delay)`, возвращающий значение, обновляющееся только после паузы в `delay` мс. Покажите, как с его помощью запускать поиск, чтобы запрос не уходил на каждый символ.

### Задание 7. Устно

1. Что значит «эффект — это синхронизация, а не жизненный цикл»?
2. Чем `useLayoutEffect` отличается от `useEffect` и когда он нужен?
3. Почему `useEffect(async () => {...})` — ошибка?
