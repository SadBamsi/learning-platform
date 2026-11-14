## Задания на закрепление

Задания 1–2 — «найди и предскажи»: **сначала ответьте письменно**, потом проверяйте в песочнице.

### Задание 1. Нарушения правил хуков

В каждом фрагменте найдите нарушение правил хуков и объясните, что именно сломается.

```jsx
// а)
function Profile({ user }) {
  if (!user) return null;
  const [tab, setTab] = useState("info");
  return <Tabs value={tab} onChange={setTab} />;
}

// б)
function List({ ids }) {
  const items = [];
  for (const id of ids) {
    items.push(useItem(id));
  }
  return <>{items.length}</>;
}

// в)
function Button() {
  function handleClick() {
    const [n, setN] = useState(0);
    setN(n + 1);
  }
  return <button onClick={handleClick}>+</button>;
}

// г)
function getUser() {
  const user = useContext(UserContext);
  return user;
}
```

### Задание 2. Что на экране?

Компонент смонтирован, прошло 5 секунд. Что на экране и что выводит `console.log`? Почему?

```jsx
function Clock() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      console.log(seconds);
      setSeconds(seconds + 1);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return <p>{seconds}</p>;
}
```

### Задание 3. Четыре исправления

Исправьте `Clock` из задания 2 четырьмя способами: (а) функциональное обновление, (б) зависимость `[seconds]`, (в) `ref` с актуальным колбэком, (г) `useEffectEvent`. Для каждого скажите: сколько раз за 5 секунд создаётся интервал?

### Задание 4. Мини-useState

Реализуйте упрощённый `useState` на массиве и счётчике индекса (без React), чтобы код ниже работал, а `render()` вызывался после каждого `setX`. Объясните, что произойдёт, если вызвать `useState` внутри `if`.

```js
function App() {
  const [a, setA] = useState(0);
  const [b, setB] = useState("x");
  console.log("render", a, b);
  return { setA, setB };
}
const api = render();
api.setA((v) => v + 1);
api.setB("y");
```

### Задание 5. Снимок против актуального

Пользователь нажимает «Отправить», через 3 секунды в консоль печатается текст сообщения. Пока идёт ожидание, он продолжает печатать. Реализуйте два варианта: печатать **текст на момент клика** и печатать **самый свежий текст**.

### Задание 6. useInterval

Напишите хук `useInterval(callback, delay)`: колбэк всегда актуальный, интервал создаётся один раз, при `delay === null` интервал на паузе. Используйте его в таймере с кнопкой «Пауза/Продолжить».

### Задание 7. Устно

Ответьте за минуту каждый:

1. Почему хуки нельзя вызывать в условиях?
2. Делят ли два компонента состояние, если оба вызывают `useCounter()`?
3. Что такое stale closure и как его опознать в коде?
