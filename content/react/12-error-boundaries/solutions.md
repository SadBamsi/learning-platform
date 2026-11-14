## Решения

### Задание 1

- а) **Да** — ошибка рендера. Пользователь увидит fallback.
- б) **Нет** — ошибки обработчиков событий граница не ловит (проверено: после клика fallback не появился). Нужен `try/catch` или проброс.
- в) **Да** — ошибка в `useEffect` попадает в границу (проверено: `caught:effect-fail`).
- г) **Нет** — ошибка внутри `.then` выбрасывается асинхронно, вне рендера. Нужен `.catch` с состоянием или проброс в границу.
- д) **Да** — ошибка, брошенная внутри `startTransition` (в том числе после `await`), попадает в границу (проверено на React 19).
- е) **Да**, если `use` находится внутри `Suspense` и промис отклонён (проверено: `caught:load-fail`).

### Задание 2

```jsx
class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { this.props.onError?.(error, info.componentStack); }
  reset = () => this.setState({ error: null });
  render() {
    return this.state.error
      ? this.props.fallback({ error: this.state.error, reset: this.reset })
      : this.props.children;
  }
}

let broken = true;
function Widget() {
  if (broken) throw new Error("widget failed");
  return <i>works</i>;
}

<div>
  <ErrorBoundary fallback={({ reset }) => <button onClick={reset}>Повторить</button>}>
    <Widget />
  </ErrorBoundary>
  <p>sibling</p>
</div>
```

Проверено: при ошибке виден fallback и соседний `sibling`; после смены причины (`broken = false`) и клика «Повторить» показывается `works`. В dev `componentDidCatch` может вызываться повторно для одной ошибки (в проверке — дважды), поэтому логирование должно быть идемпотентным.

### Задание 3

```jsx
// 1. Пробросить в границу через setState
function useThrowAsync() {
  const [, setState] = useState();
  return (error) => setState(() => { throw error; });
}

function Load() {
  const throwAsync = useThrowAsync();
  return <button onClick={() => fetch("/api").then(check).catch(throwAsync)}>Загрузить</button>;
}

// 2. startTransition (React 19)
function Save() {
  const [, startTransition] = useTransition();
  return (
    <button onClick={() => startTransition(async () => {
      const res = await fetch("/api/save", { method: "POST" });
      if (!res.ok) throw new Error("save failed");
    })}>Сохранить</button>
  );
}
```

Проверено: обе техники доставляют ошибку в границу (`caught:net`, `caught:action-fail`). Показывать **на месте** (через состояние) нужно ожидаемые ситуации: ошибка валидации, 404 «не найдено», нет прав — пользователь может исправить. **В границу** — непредвиденные сбои: баги, недоступность критичного API, ошибка загрузки обязательных данных.

### Задание 4

```jsx
import { ErrorBoundary } from "react-error-boundary";

function ProfilePage({ userId }) {
  return (
    <ErrorBoundary resetKeys={[userId]} fallbackRender={({ error }) => <p>Ошибка: {error.message}</p>}>
      <User id={userId} />
    </ErrorBoundary>
  );
}
```

Собственная реализация:

```jsx
const changed = (a = [], b = []) => a.length !== b.length || a.some((x, i) => !Object.is(x, b[i]));

class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidUpdate(prev) {
    if (this.state.error && changed(prev.resetKeys, this.props.resetKeys)) this.setState({ error: null });
  }
  render() { /* как выше */ }
}
```

Проверено: при `id: 1 → 2` (ошибка) виден fallback; повторный рендер с тем же `id` ошибку **не снимает**; смена на `id = 3` сбрасывает границу и показывает `user 3`.

### Задание 5

```
<AppBoundary>                     ← верхний уровень: «Что-то пошло не так» + перезагрузка
  <Header />                      ← без отдельной границы: критична для навигации
  <Menu />
  <main>
    <RouteBoundary>               ← ошибка страницы не ломает шапку и меню
      <Feed />
      <ErrorBoundary fallback="Погода недоступна"><Weather /></ErrorBoundary>
      <ErrorBoundary fallback="Чат временно недоступен"><Chat /></ErrorBoundary>
    </RouteBoundary>
  </main>
</AppBoundary>
```

Если упадёт погода — сообщение «Погода недоступна», остальное работает. Если упадёт шапка (без отдельной границы) — ошибка поднимется до `AppBoundary`, и пользователь увидит общий fallback; поэтому критичные части должны быть максимально простыми и надёжными.

### Задание 6

Что отправлять: сообщение и стек ошибки, `componentStack`, версию сборки, маршрут, идентификатор сессии/пользователя (внутренний id), контекст действий. Нельзя: пароли, токены, персональные данные, содержимое форм. Ошибки вне границ — `window.addEventListener("error", ...)` и `"unhandledrejection"`. В React 19 хуки уровня корня:

```jsx
createRoot(container, {
  onCaughtError: (error, info) => report("caught", error, info.componentStack),
  onUncaughtError: (error, info) => report("uncaught", error, info.componentStack),
  onRecoverableError: (error, info) => report("recoverable", error, info.componentStack),
});
```

(Опции описаны в документации React к `createRoot`. Не забудьте source maps для читаемых стеков.)

### Задание 7

1. Границы используют методы `getDerivedStateFromError` и `componentDidCatch`, которые существуют только у классовых компонентов; хуков-аналогов нет.
2. Дерево размонтируется целиком: пользователь видит пустую страницу (проверено: после необработанной ошибки рендера DOM корня пуст).
3. `try/catch` обрабатывает только выполняемый в этой точке императивный код; создание элемента `<Child />` ничего не вызывает — `Child` будет вызван позже самим React при рендере, вне вашего `try`.
