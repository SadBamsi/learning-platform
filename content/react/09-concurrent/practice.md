## Задания на закрепление

### Задание 1. Порядок рендеров

Нажимаем кнопку. Напишите порядок строк в консоли для обоих компонентов.

```jsx
function Slow({ tab }) {
  console.log("Slow", tab);
  const t0 = Date.now(); while (Date.now() - t0 < 30);   // имитация тяжёлого рендера
  return <i>{tab}</i>;
}

function A() {
  const [tab, setTab] = useState("a");
  const [isPending, start] = useTransition();
  console.log("A", tab, isPending);
  return (<><button onClick={() => start(() => setTab("b"))}>go</button><Slow tab={tab} /></>);
}

const List = ({ q }) => { console.log("List", q); return <i>{q}</i>; };
function B() {
  const [q, setQ] = useState("");
  const dq = useDeferredValue(q);
  console.log("B", q, dq);
  return (<><button onClick={() => setQ("abc")}>go</button><List q={dq} /></>);
}
```

Что изменится в `B`, если обернуть `List` в `memo`?

### Задание 2. Вкладки с тяжёлым содержимым

Три вкладки, одна из них очень медленная. При переключении на медленную вкладку кнопки должны оставаться отзывчивыми, а активная вкладка не должна «мигать» пустым экраном. Реализуйте через `useTransition` и покажите `isPending`.

### Задание 3. Фильтр большого списка

Поле ввода фильтрует 10 000 элементов, и ввод лагает. Решите через `useDeferredValue`. Почему список нужно обернуть в `memo`? Чем решение отличается от debounce, и когда нужны оба?

### Задание 4. Suspense и use

Реализуйте компонент `User`, который читает данные через `use(fetchUser(id))`. Покажите: (а) корректный вариант с кэшированием промисов; (б) ошибочный вариант с промисом, создаваемым в рендере, и объясните симптом.

### Задание 5. Переход без мигания

В приложении из задания 4 кнопка «Следующий» меняет `id`. Сейчас при каждом клике пользователь видит скелетон вместо данных. Исправьте так, чтобы старые данные оставались на экране, а рядом показывалась метка «Загрузка…».

### Задание 6. Что нельзя класть в transition

Почему этот код ломает поле ввода и как исправить?

```jsx
function Search() {
  const [query, setQuery] = useState("");
  const [, startTransition] = useTransition();
  return (
    <input
      value={query}
      onChange={(e) => startTransition(() => setQuery(e.target.value))}
    />
  );
}
```

### Задание 7. Устно

1. Concurrent-рендеринг — это многопоточность?
2. Почему рендер должен быть чистым, когда включены transitions?
3. Когда `useTransition` не поможет?
