## Решения

### Задание 1

Для `[id]`:

```
effect 1          ← монтирование
(повторный рендер с тем же id — ничего)
cleanup 1         ← перед запуском для нового id
effect 2
cleanup 2         ← размонтирование
```

Для `[]`: `effect 1` при монтировании и `cleanup 1` при размонтировании; смена `id` ничего не вызывает, а внутри эффекта навсегда остаётся `id = 1`. Без массива: эффект запускается после каждого рендера, и перед каждым запуском вызывается cleanup предыдущего. Вариант с `[id]` проверен запуском.

### Задание 2

Нет `cleanup`. В StrictMode эффект запускается, останавливается и запускается снова, но первый обработчик не снят. Исправление:

```jsx
useEffect(() => {
  const onResize = () => setW(window.innerWidth);
  window.addEventListener("resize", onResize);
  return () => window.removeEventListener("resize", onResize);
}, []);
```

Проверка без DevTools: обернуть `window.addEventListener`/`removeEventListener` счётчиком (как в тесте) или использовать `getEventListeners(window)` в консоли Chrome. Результат на запуске: без cleanup после монтирования 2 слушателя и 2 после размонтирования; с cleanup — 1 и 0.

### Задание 3

Причина: запросы завершаются не в порядке отправки; более медленный ответ на старый `query` приходит позже и записывается в состояние поверх свежего. Проверено на имитации: без защиты остаётся ответ для первого запроса.

```jsx
// Флаг
useEffect(() => {
  let ignore = false;
  setLoading(true);
  setError(null);
  fetch(`/api/search?q=${encodeURIComponent(query)}`)
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((data) => { if (!ignore) setResults(data); })
    .catch((e) => { if (!ignore) setError(e); })
    .finally(() => { if (!ignore) setLoading(false); });
  return () => { ignore = true; };
}, [query]);

// AbortController
useEffect(() => {
  const ac = new AbortController();
  setLoading(true);
  setError(null);
  fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: ac.signal })
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(setResults)
    .catch((e) => { if (e.name !== "AbortError") setError(e); })
    .finally(() => { if (!ac.signal.aborted) setLoading(false); });
  return () => ac.abort();
}, [query]);
```

Оба подхода проверены на имитации запросов: остаётся результат последнего запроса; при отмене старый запрос завершается с `AbortError`. `AbortController` дополнительно экономит трафик, но нужно отдельно игнорировать `AbortError`. В продакшене лучше TanStack Query или SWR: они дают кэш, дедупликацию, повторные попытки и устраняют гонки.

### Задание 4

Объект `filter` создаётся при каждом рендере, поэтому зависимость `filter` каждый раз «новая». Эффект запускается, делает `setList` с новым массивом, компонент рендерится, создаётся новый `filter`, эффект запускается снова — цикл.

Исправления:

```jsx
// 1. Вынести константу за пределы компонента
const FILTER = { active: true };

// 2. Не использовать объект: зависеть от примитива
const active = true;
useEffect(() => { setList(items.filter((i) => i.active === active)); }, [items, active]);

// 3. Лучше всего — не использовать эффект: вычислить при рендере
const list = items.filter((i) => i.active);
// при дорогой фильтрации: const list = useMemo(() => items.filter((i) => i.active), [items]);
```

Вариант 3 решает и проблему лишнего рендера: «эффект + `setState`» даёт 2 рендера, вычисление при рендере — 1 (проверено).

### Задание 5

```jsx
// а) считать при рендере
const fullName = first + " " + last;

// б) отправка аналитики — в обработчике, где происходит действие
function handleSubmit() {
  sendAnalytics("form_submitted");
  // ...остальная логика отправки
}

// в) сброс — через key в месте использования
<Comment key={postId} postId={postId} />
```

Для (в) проверено: сброс через эффект даёт промежуточный рендер со старым текстом (`effect:2:typed`), затем пустой; `key` создаёт компонент заново без этого промежуточного состояния.

### Задание 6

```jsx
function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function SearchBox() {
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);
  useEffect(() => {
    if (!debouncedQ) return;
    const ac = new AbortController();
    fetch(`/api/search?q=${encodeURIComponent(debouncedQ)}`, { signal: ac.signal }) /* ... */;
    return () => ac.abort();
  }, [debouncedQ]);
  return <input value={q} onChange={(e) => setQ(e.target.value)} />;
}
```

Проверено: при вводе `r, re, rea, reac, react` с паузами по 20 мс при `delay = 80` эффект на `debouncedQ` срабатывает дважды: для начального значения `""` и для итогового `"react"`. Cleanup сбрасывает таймер при каждом новом значении — ключевая часть debounce.

### Задание 7

1. Эффект описывает «пока значения X такие, внешняя система настроена так»: запуск, остановка (cleanup) и перезапуск при смене зависимостей. Вопрос не «когда он вызывается», а «с чем синхронизируемся и от чего это зависит».
2. `useLayoutEffect` выполняется синхронно после изменения DOM и **до** отрисовки кадра. Нужен для измерений и правки позиции без «мигания» (тултипы, измерение размеров). Блокирует отрисовку, поэтому в остальных случаях используют `useEffect`. На сервере эффекты не выполняются.
3. `async`-функция возвращает Promise, а React ожидает от эффекта `undefined` или функцию cleanup. React предупреждает об этом. Нужно объявить `async`-функцию внутри эффекта и вызвать её (и учесть отмену/игнорирование устаревшего результата).
