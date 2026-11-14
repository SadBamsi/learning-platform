## Задания на закрепление

Задания 1–2 — «предскажи результат»: **сначала запишите ответ, потом проверяйте.** Остальные — исправить/написать код.

### Задание 1. Сколько получится?

Начальное значение `n = 0`. Что будет на экране после **одного** клика в каждом случае?

```jsx
// а)
setN(n + 1); setN(n + 1); setN(n + 1);

// б)
setN((x) => x + 1); setN((x) => x + 1); setN((x) => x + 1);

// в)
setN(n + 5); setN((x) => x + 1);

// г)
setN(n + 5); setN((x) => x + 1); setN(42);

// д)
setN(5); setN((x) => x * 2); setN((x) => x + 1);
```

### Задание 2. Что в консоли?

Нажимаем кнопку один раз. Что выведут два `console.log`? Затем: быстро нажимаем «Показать через 2 секунды», а потом три раза «+1». Что покажет таймер?

```jsx
function Demo() {
  const [n, setN] = useState(0);
  return (
    <>
      <button onClick={() => { setN(n + 1); console.log("handler:", n); }}>+1</button>
      <button onClick={() => setTimeout(() => console.log("timer:", n), 2000)}>
        Показать через 2 секунды
      </button>
      <p>{console.log("render:", n) ?? n}</p>
    </>
  );
}
```

### Задание 3. Мутация

Список задач не обновляется после добавления и «галочка» не работает. Исправьте без мутаций и добавьте иммутабельные `remove` и `rename`.

```jsx
function Todos() {
  const [todos, setTodos] = useState([{ id: 1, title: "Купить молоко", done: false }]);

  function add(title) {
    todos.push({ id: Date.now(), title, done: false });
    setTodos(todos);
  }
  function toggle(id) {
    const t = todos.find((x) => x.id === id);
    t.done = !t.done;
    setTodos(todos);
  }
  // remove(id), rename(id, title) — допишите
}
```

### Задание 4. Лишнее состояние

Перепишите так, чтобы остался **один** `useState` (и никакого `useEffect`), а все остальные значения вычислялись при рендере. Дополнительно: что будет, если пользователь редактирует `users`, пока открыт `selected`, и как хранить выбранного пользователя правильно?

```jsx
function UserList({ users }) {
  const [query, setQuery] = useState("");
  const [filtered, setFiltered] = useState(users);
  const [count, setCount] = useState(users.length);
  const [selected, setSelected] = useState(null);       // здесь лежит КОПИЯ объекта пользователя

  useEffect(() => {
    const f = users.filter((u) => u.name.toLowerCase().includes(query.toLowerCase()));
    setFiltered(f);
    setCount(f.length);
  }, [users, query]);
  // ...
}
```

### Задание 5. Подъём состояния

Есть два поля: «Цельсий» и «Фаренгейт». При вводе в одно второе должно пересчитываться (`F = C * 9/5 + 32`). Сейчас у каждого поля своё состояние, и они не синхронизируются. Реализуйте решение с **одним** источником правды. Подсказка: храните число и «в какой шкале оно введено».

### Задание 6. useReducer

Переведите корзину на `useReducer`: действия `add` (если товар уже есть — увеличить `qty`), `remove`, `setQty` (если `qty <= 0` — удалить товар), `clear`. Напишите редьюсер как чистую функцию и проверьте его тремя тестами на `node:test` (без React).

### Задание 7. Копия props в state

Почему при смене пропса `color` цвет не меняется? Назовите два способа исправления и выберите подходящий для случая «пользователь может править значение, но при смене `userId` оно должно сброситься».

```jsx
function Badge({ color }) {
  const [c, setC] = useState(color);
  return <span style={{ color: c }} onClick={() => setC("red")}>badge</span>;
}
```
