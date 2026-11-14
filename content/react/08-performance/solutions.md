## Решения

### Задание 1

Пример плана:

1. **Воспроизвести в production-сборке** (или в профильной сборке) на данных, близких к реальным; зафиксировать исходные числа: LCP/INP в Lighthouse или DevTools, размер бандла, время ввода.
2. **Ввод в фильтр.** React Profiler: что рендерится при вводе, сколько это занимает, почему (state/props/контекст). Гипотезы: перерисовывается вся таблица на каждый символ; фильтрация + рендер 5000 строк в одном рендере; лишние рендеры строк; ключи по индексу.
3. **Исправления по убыванию эффекта:** виртуализация (в DOM 20–30 строк вместо 5000); `useDeferredValue` для значения фильтра, чтобы ввод оставался срочным; `memo`-строки со стабильными пропсами; фильтрация через `useMemo`; при больших данных — фильтрация на сервере.
4. **Первая загрузка.** Network/Performance: размер бандла (визуализатор), водопады запросов, LCP-элемент. Гипотезы: тяжёлая таблица/библиотека в основном бандле; данные грузятся после гидратации. Исправления: `lazy` для тяжёлых частей, SSR/стриминг, оптимизация изображений и шрифтов, кэш.
5. **Проверка:** повторить замеры, сравнить с исходными числами; зафиксировать бюджет (Lighthouse CI/размер бандла в CI).

### Задание 2

```jsx
<Profiler
  id="table"
  onRender={(id, phase, actualDuration, baseDuration) =>
    console.log(id, phase, actualDuration.toFixed(1), baseDuration.toFixed(1))
  }
>
  <Table />
</Profiler>
```

Проверено: колбэк вызывается на монтировании (`mount`) и на каждом коммите обновления (`update`); `actualDuration` и `baseDuration` — числа.

Если `actualDuration` ≪ `baseDuration` — мемоизация сработала: пересчитывалась лишь малая часть дерева. Если они почти равны при частых обновлениях — мемоизации нет или она не срабатывает: при каждом обновлении рендерится почти всё поддерево. (Profiler доступен в dev и в специальной профильной production-сборке.)

### Задание 3

```jsx
const ROW = 20, VIEW = 100;

function VirtualList({ items }) {
  const [top, setTop] = useState(0);
  const start = Math.max(0, Math.floor(top / ROW) - 2);
  const end = Math.min(items.length, Math.ceil((top + VIEW) / ROW) + 2);
  return (
    <div style={{ height: VIEW, overflow: "auto" }} onScroll={(e) => setTop(e.currentTarget.scrollTop)}>
      <div style={{ height: items.length * ROW, position: "relative" }}>
        {items.slice(start, end).map((item, i) => (
          <div key={item} style={{ position: "absolute", top: (start + i) * ROW, height: ROW }}>{item}</div>
        ))}
      </div>
    </div>
  );
}
```

Проверено в jsdom (с установкой `scrollTop` и событием `scroll`): вверху в DOM 7 строк (`row 0`…`row 6`), после `scrollTop = 5000` — 9 строк (`row 248`…`row 256`). Внешний контейнер имеет полную высоту `items.length * ROW`, поэтому полоса прокрутки остаётся «настоящей». В реальном проекте лучше использовать `@tanstack/react-virtual` или `react-window` (учёт динамической высоты, доступность, ресайз).

### Задание 4

```jsx
const loadEditor = () => import("./Editor");
const Editor = lazy(loadEditor);

function Page() {
  const [editing, setEditing] = useState(false);
  return (
    <>
      <button
        onMouseEnter={loadEditor}          // начать загрузку заранее
        onFocus={loadEditor}
        onClick={() => setEditing(true)}
      >
        Редактировать
      </button>
      <Suspense fallback={<p>Загрузка редактора…</p>}>
        {editing && <Editor />}
      </Suspense>
    </>
  );
}
```

`lazy` вызывает `import()` только при первом рендере `Editor`; проверено на имитации загрузки: до показа чанк не загружен, затем виден `fallback`, потом компонент. Повторный `import()` того же модуля не загружает код заново (модуль уже в кэше загрузчика).

### Задание 5

```jsx
// а) ref и прямая запись в DOM — 0 рендеров
function Tracker() {
  const el = useRef(null);
  return (
    <div onMouseMove={(e) => { el.current.textContent = `${e.clientX}, ${e.clientY}`; }}>
      <span ref={el}>0, 0</span>
    </div>
  );
}

// б) не чаще одного обновления за кадр
function Tracker2() {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const frame = useRef(0);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  return (
    <div
      onMouseMove={(e) => {
        const { clientX: x, clientY: y } = e;                 // событие нельзя использовать позже, берём значения
        cancelAnimationFrame(frame.current);
        frame.current = requestAnimationFrame(() => setPos({ x, y }));
      }}
    >
      {pos.x}, {pos.y}
    </div>
  );
}

// в) CSS-переменные: React не рендерит, браузер пересчитывает стили
<div
  onMouseMove={(e) => {
    e.currentTarget.style.setProperty("--x", e.clientX + "px");
    e.currentTarget.style.setProperty("--y", e.clientY + "px");
  }}
  className="spotlight"
/>
```

Проверено для варианта (а): при 5 событиях `mousemove` в варианте со `state` было 5 рендеров, с `ref` — 0, текст обновился. Вариант (б) и (в) не запускались в браузере.

### Задание 6

1. **`filtered` в состоянии + эффект** — лишний рендер и дублирование. Считать при рендере: `const filtered = useMemo(() => rows.filter(...), [rows, query])`.
2. **Компонент `Cell` объявлен внутри `Table`** — на каждый рендер новый тип: все ячейки размонтируются и создаются заново. Вынести за пределы `Table`.
3. **`key={i}`** — индексы в качестве ключей ломают соответствие при фильтрации. Использовать `r.id`.
4. **5000 строк в DOM** — виртуализация или пагинация.
5. **Инлайн `onClick={() => select(r)}`** создаёт новую функцию для каждой строки; при мемоизированной строке это ломает `memo`. Передавать `onSelect` и `id`, а лямбду создавать внутри строки.
6. **Фильтрация на каждый символ** при большом наборе — `useDeferredValue(query)` или debounce, чтобы ввод оставался отзывчивым.

### Задание 7

1. В dev включены дополнительные проверки, предупреждения и двойной рендер StrictMode; код не минифицирован и не оптимизирован. Числа из dev не отражают поведение у пользователя.
2. INP (Interaction to Next Paint) — метрика отзывчивости: время от действия пользователя (клик, касание, клавиша) до следующей отрисовки. Это про интерактивность на протяжении сессии, а LCP — про скорость показа основного контента при загрузке.
3. Если `lazy` применён к маленьким или всегда нужным компонентам: добавляется лишний запрос и индикатор загрузки, а выигрыша в размере бандла почти нет; а также если не использовать упреждающую загрузку для критичного пути.
