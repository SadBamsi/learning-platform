## Задания на закрепление

Задания 1–2 и 6 — «предскажи результат»: **сначала запишите ответ, потом проверяйте** (в Vite/Next-проекте или в песочнице вроде StackBlitz). Файлы с JSX — `.jsx`/`.tsx`.

### Задание 1. Кто перерисуется?

После клика на кнопку какие компоненты выведут свой лог? Почему?

```jsx
import { memo, useState } from "react";

const Plain = () => { console.log("Plain"); return <i>plain</i>; };
const Memo = memo(function Memo() { console.log("Memo"); return <i>memo</i>; });

function Counter({ children }) {
  const [n, setN] = useState(0);
  console.log("Counter");
  return (
    <div>
      <button onClick={() => setN(n + 1)}>{n}</button>
      <Plain />
      <Memo />
      {children}
    </div>
  );
}

export default function App() {
  console.log("App");
  return <Counter><Plain /></Counter>;
}
```

Подсказка: в `Counter` два разных `<Plain />` — один создан внутри `Counter`, другой передан как `children` из `App`.

### Задание 2. Сохранится ли состояние?

`Counter` — компонент с `useState(0)` и кнопкой «+1». Пользователь нажал «+1» дважды (значение 2), затем `flag` стал `false`. Каким станет значение счётчика в каждом из случаев?

```jsx
// а)
flag ? <Counter /> : <Counter />

// б)
flag ? <Counter /> : <div><Counter /></div>

// в)
<div>{flag && <p>Подсказка</p>}<Counter /></div>

// г)
flag ? <Counter key="a" /> : <Counter key="b" />
```

### Задание 3. Баг с индексом

Список из трёх строк. В каждой строке есть поле ввода с собственным состоянием. Пользователь вводит текст в поле первой строки и нажимает «Удалить» у первой строки — но текст почему-то остаётся в (бывшей второй) первой строке. Найдите причину и исправьте.

```jsx
function Row({ item, onRemove }) {
  const [draft, setDraft] = useState("");
  return (
    <li>
      {item.name}
      <input value={draft} onChange={(e) => setDraft(e.target.value)} />
      <button onClick={() => onRemove(item.id)}>Удалить</button>
    </li>
  );
}

function List() {
  const [items, setItems] = useState([
    { id: "a", name: "A" }, { id: "b", name: "B" }, { id: "c", name: "C" },
  ]);
  return (
    <ul>
      {items.map((item, i) => (
        <Row key={i} item={item} onRemove={(id) => setItems(items.filter((x) => x.id !== id))} />
      ))}
    </ul>
  );
}
```

### Задание 4. Поле ввода теряет фокус

При вводе каждого символа поле теряет фокус, и приходится кликать в него снова. Почему? Исправьте двумя способами.

```jsx
function SearchForm() {
  const [query, setQuery] = useState("");
  const Field = () => (
    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск" />
  );
  return <form><Field /></form>;
}
```

### Задание 5. Сброс формы при смене сущности

Компонент `ProfileForm` хранит черновик имени в состоянии. Когда `userId` меняется, черновик должен очищаться. Сейчас это сделано через `useEffect`. Перепишите так, чтобы не было `useEffect` и лишнего рендера со старым значением.

```jsx
function ProfileForm({ userId }) {
  const [name, setName] = useState("");
  useEffect(() => { setName(""); }, [userId]);
  return <input value={name} onChange={(e) => setName(e.target.value)} />;
}
```

### Задание 6. Порядок вызовов

Предскажите порядок строк в консоли при первом монтировании и при последующем клике на кнопку. Где находятся cleanup'ы?

```jsx
function Child() {
  console.log("render Child");
  useLayoutEffect(() => { console.log("layout Child"); return () => console.log("layout cleanup Child"); });
  useEffect(() => { console.log("effect Child"); return () => console.log("effect cleanup Child"); });
  return <i />;
}

function Parent() {
  const [n, setN] = useState(0);
  console.log("render Parent");
  useLayoutEffect(() => { console.log("layout Parent"); return () => console.log("layout cleanup Parent"); });
  useEffect(() => { console.log("effect Parent"); return () => console.log("effect cleanup Parent"); });
  return <div><button onClick={() => setN(n + 1)}>{n}</button><Child /></div>;
}
```

### Задание 7. Объясните устно

За одну минуту, без заглядывания в теорию, ответьте: что такое Virtual DOM, делает ли он React быстрым, что происходит между `setState` и появлением изменений на экране. Запишите ответ в 5–7 предложениях.
