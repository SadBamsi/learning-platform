## Решения

### Задание 1

- а) Ранний `return` **до** хука: число вызванных хуков зависит от `user`. Правило `rules-of-hooks` это запрещает. В рантайме поведение зависит от обстоятельств (проверено на React 19.3.1): если **до** раннего `return` в компоненте есть другой хук, переключение `user` даёт ошибки «Rendered fewer hooks than expected» (объект → `null`) и «Rendered more hooks than during the previous render» (`null` → объект при уже смонтированном компоненте). Если же в компоненте вообще нет хуков до `return`, React в этом примере ошибку не выбросил (первый рендер без хуков он трактует как монтирование), но полагаться на это нельзя. Исправление: вызвать `useState` до `return`.
- б) Хук в цикле: число вызовов зависит от длины `ids`, порядок ячеек «съезжает» при изменении массива. Исправление: вынести в дочерний компонент `<Item id={id} />` с `useItem` внутри (или один хук, получающий весь массив).
- в) Хук внутри обработчика: он выполняется вне рендера, React выбросит «Invalid hook call». Исправление: `useState` на верхнем уровне компонента.
- г) Функция называется `getUser`, а не `useUser`: линтер не распознает её как хук и сообщит об ошибке вызова `useContext`; сама функция при этом сработает, если её вызвать из компонента на верхнем уровне. Исправление — переименовать в `useUser`.

Варианты б и в проверены запуском (б — «Rendered more hooks…», в — «Invalid hook call»; ошибка из обработчика приходит как необработанная ошибка окна, а не падает в рендере).

### Задание 2

`console.log` выводит `0, 0, 0, 0, 0`, на экране остаётся **`1`**. Эффект с `[]` выполнился один раз в рендере, где `seconds = 0`; колбэк таймера навсегда запомнил это значение, и каждый тик ставит `0 + 1`. Проверено запуском: лог `[0, 0, 0, 0]`, экран `1`. (В StrictMode в разработке интервал создаётся дважды из-за повторного монтирования эффекта, но cleanup снимает первый.)

### Задание 3

```jsx
// а) функциональное обновление — интервал создаётся 1 раз
useEffect(() => {
  const id = setInterval(() => setSeconds((s) => s + 1), 1000);
  return () => clearInterval(id);
}, []);

// б) зависимость [seconds] — интервал пересоздаётся на каждом тике (≈ 5 раз)
useEffect(() => {
  const id = setInterval(() => setSeconds(seconds + 1), 1000);
  return () => clearInterval(id);
}, [seconds]);

// в) ref с актуальным колбэком — 1 раз
const saved = useRef();
useEffect(() => { saved.current = () => setSeconds(seconds + 1); });
useEffect(() => {
  const id = setInterval(() => saved.current(), 1000);
  return () => clearInterval(id);
}, []);

// г) useEffectEvent (React 19.2+) — 1 раз
const tick = useEffectEvent(() => setSeconds(seconds + 1));
useEffect(() => {
  const id = setInterval(() => tick(), 1000);
  return () => clearInterval(id);
}, []);
```

Все четыре варианта проверены: счёт идёт `0, 1, 2, 3, 4…`. Для простого счётчика лучший вариант — (а): замыкание не нужно вовсе.

### Задание 4

```js
let hooks = [];
let idx = 0;

function useState(initial) {
  const i = idx++;
  if (!(i in hooks)) hooks[i] = initial;
  const setState = (v) => {
    hooks[i] = typeof v === "function" ? v(hooks[i]) : v;
    render();
  };
  return [hooks[i], setState];
}

function render() {
  idx = 0;
  return App();
}
```

Вывод (проверен): `render 0 x`, `render 1 x`, `render 1 y`; итоговое состояние `[1, "y"]`.

Если `useState` внутри `if`, то при ложном условии нумерация хуков сдвигается: следующий `useState` получит индекс, которым раньше владел другой, и вернёт чужое значение. Именно поэтому порядок вызовов должен быть одинаковым.

### Задание 5

```jsx
function Composer() {
  const [text, setText] = useState("");
  const latest = useRef(text);
  latest.current = text;                  // всегда последний текст (запись в обработчиках/эффектах надёжнее)

  const sendSnapshot = () => setTimeout(() => console.log("снимок:", text), 3000);
  const sendLatest = () => setTimeout(() => console.log("актуальный:", latest.current), 3000);
  // ...
}
```

Проверено: после клика и последующей смены текста `a → b` снимок печатает `a`, вариант через `ref` — `b`. Запись в `ref` во время рендера допустима в учебном примере, но в продакшене надёжнее обновлять её в эффекте (`useEffect(() => { latest.current = text; })`), чтобы render оставался чистым.

### Задание 6

```jsx
function useInterval(callback, delay) {
  const saved = useRef(callback);
  useEffect(() => { saved.current = callback; });

  useEffect(() => {
    if (delay === null) return;
    const id = setInterval(() => saved.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

function Timer() {
  const [n, setN] = useState(0);
  const [running, setRunning] = useState(true);
  useInterval(() => setN(n + 1), running ? 1000 : null);
  return (
    <div>
      <p>{n}</p>
      <button onClick={() => setRunning((r) => !r)}>{running ? "Пауза" : "Продолжить"}</button>
    </div>
  );
}
```

Проверено: счёт идёт, при паузе значение не меняется, при продолжении счёт возобновляется.

### Задание 7

1. React сопоставляет состояние хуков с компонентом **по порядку вызова**, идентификаторов у хуков нет. Условный вызов меняет порядок и ломает соответствие.
2. Нет: каждый вызов хука создаёт собственное состояние (проверено: клик по одному счётчику не меняет второй). Для общего состояния — контекст или внешний стор.
3. Stale closure — колбэк, живущий дольше одного рендера (таймер, подписка, эффект с неполными зависимостями), читает `props`/`state` из рендера, в котором был создан. Признаки: пустой или неполный массив зависимостей, значения «застревают» на старом, предупреждение `exhaustive-deps`.
