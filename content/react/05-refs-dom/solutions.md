## Решения

### Задание 1

- а) `useRef` — id нужен только для очистки, на экран не влияет.
- б) `useState` — значение показывается в превью, значит, влияет на интерфейс.
- в) `useRef` — ссылка на DOM-узел.
- г) `useRef` — число рендеров не должно вызывать новый рендер. Но менять его нужно **не** в теле компонента, а в эффекте (`useEffect(() => { renders.current++ })`), иначе рендер нечист (см. задание 8).
- д) `useRef` — флаг не влияет на UI.
- е) `useState` — выбранная вкладка меняет отображение.

### Задание 2

**0 рендеров**, на экране остаётся `0`, хотя `count.current` уже `2` (проверено запуском). Изменение `ref` не запускает рендер. С `useState` каждый клик даёт рендер, на экране `1`, затем `2`.

### Задание 3

```jsx
function Chat() {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const inputRef = useRef(null);
  const endRef = useRef(null);

  function send(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setMessages((m) => [...m, { id: crypto.randomUUID(), text }]);
    setText("");
    inputRef.current.focus();
  }

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <form onSubmit={send}>
      <ul>
        {messages.map((m) => <li key={m.id}>{m.text}</li>)}
        <li ref={endRef} />
      </ul>
      <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} />
      <button>Отправить</button>
    </form>
  );
}
```

Прокрутку нужно делать в `useEffect` (или `useLayoutEffect`, если нужно избежать мигания) **после** того, как новое сообщение попало в DOM, а `ref` на последний элемент указывает на актуальный узел. Если вызвать `scrollIntoView` в обработчике сразу после `setMessages`, новый элемент ещё не отрисован. Фокус на поле безопасно ставить в обработчике. (Прокрутка зависит от браузера и в jsdom, где нет раскладки, не проверялась.)

### Задание 4

```jsx
// React 19: ref как проп
function TextInput({ ref }) {
  const inner = useRef(null);
  useImperativeHandle(ref, () => ({
    focus: () => inner.current.focus(),
    clear: () => { inner.current.value = ""; },
  }), []);
  return <input ref={inner} defaultValue="abc" />;
}

// вариант с forwardRef
const TextInput2 = forwardRef(function TextInput2(props, ref) {
  const inner = useRef(null);
  useImperativeHandle(ref, () => ({
    focus: () => inner.current.focus(),
    clear: () => { inner.current.value = ""; },
  }), []);
  return <input ref={inner} defaultValue="abc" />;
});
```

Проверено: родитель видит `['focus', 'clear']`, вызов `clear()` обнуляет поле; оба варианта работают на React 19. Если нужен просто доступ к DOM-узлу, достаточно передать `ref` на `<input>` без `useImperativeHandle`.

### Задание 5

```jsx
function Stopwatch() {
  const [ms, setMs] = useState(0);
  const [running, setRunning] = useState(false);
  const timerId = useRef(null);

  function start() {
    if (timerId.current !== null) return;
    setRunning(true);
    timerId.current = setInterval(() => setMs((x) => x + 10), 10);
  }
  function stop() {
    clearInterval(timerId.current);
    timerId.current = null;
    setRunning(false);
  }
  function reset() { stop(); setMs(0); }

  useEffect(() => () => clearInterval(timerId.current), []);   // очистка при размонтировании

  return (
    <div>
      <p>{(ms / 1000).toFixed(2)} c</p>
      <button onClick={start} disabled={running}>Старт</button>
      <button onClick={stop}>Стоп</button>
      <button onClick={reset}>Сброс</button>
    </div>
  );
}
```

id интервала хранится в `ref`: он нужен только для очистки и не влияет на экран. Проверено: два клика по «Старт» не удваивают скорость, после «Стоп» значение не меняется.

### Задание 6

```jsx
function usePrevious(value) {
  const ref = useRef();
  useEffect(() => { ref.current = value; });
  return ref.current;
}
```

Рендер читает `ref.current` **до** того, как эффект этого рендера его обновит; эффект выполняется после commit. Поэтому во время рендера в `ref` лежит значение предыдущего рендера. Для последовательности `1 → 2 → 2 → 3` результат будет `undefined, 1, 2, 2` (на третьем рендере значение не меняется, но «предыдущее» — это значение прошлого рендера). Проверено для перехода `1 → 2`: показано `1`.

### Задание 7

```jsx
function useElementWidth() {
  const [width, setWidth] = useState(0);
  const ref = useCallback((el) => {
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}
```

Проверено с заглушкой `ResizeObserver`: ширина обновляется, при размонтировании узла вызывается `disconnect`, наблюдатель создаётся один раз. Возврат cleanup из callback ref поддерживается в React 19; в более ранних версиях для этого использовали `ref(null)`.

Без `useCallback` каждый рендер создаёт новую функцию, и React вызывает старую с `null`, а новую с элементом (проверено: `[null, attach]`). Наблюдатель пересоздаётся на каждом рендере, а так как `setWidth` вызывает рендер, возможен лишний цикл переподписок.

### Задание 8

Рендер читает и пишет `ref.current`, поэтому он перестаёт быть чистой функцией: в `StrictMode` (двойной вызов) счётчик уже при первом рендере показывает 2 (проверено на аналогичном примере), а в concurrent-режиме рендеры могут прерываться и отбрасываться, так что число не будет совпадать с реальным количеством применённых обновлений.

Исправление зависит от цели:

- **Для отладки** — не показывать число на экране: использовать `console.log`, React DevTools Profiler или считать применённые рендеры в эффекте (`useEffect(() => { renders.current += 1; })`) и смотреть в консоли.
- **Если число нужно пользователю** (например, число элементов), оно должно вычисляться из данных: `items.length`.

```jsx
function List({ items }) {
  const renders = useRef(0);
  useEffect(() => { renders.current += 1; });   // побочное действие вне рендера
  return (
    <div>
      <p>Элементов: {items.length}</p>
      <ul>{items.map((i) => <li key={i}>{i}</li>)}</ul>
    </div>
  );
}
```
