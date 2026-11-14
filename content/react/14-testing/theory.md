> **Ответ за 30 секунд.** Компоненты React тестируют **как пользователь**: рендерят компонент (`render` из **React Testing Library**), находят элементы так, как их находит человек или скринридер (`getByRole`, `getByLabelText`, `getByText`), выполняют действия через **`userEvent`** и проверяют **видимый результат** (текст, роль, доступность), а не внутреннее состояние или имена методов. Асинхронные изменения ждут через `findBy…`/`waitFor`; сеть мокают на уровне `fetch`/**MSW**, модули — через `vi.mock`/`jest.mock`, время — через fake timers. Хуки тестируют через `renderHook`, контекст — через `wrapper`. Раннер — **Vitest** или **Jest** (RTL работает с обоими). Такие тесты устойчивы к рефакторингу. Они дополняют, но не заменяют **E2E** (Playwright/Cypress) для полных пользовательских сценариев и серверных частей (в том числе Server Components).

## Что именно спрашивают

- «Как тестировать React-компоненты? Что такое React Testing Library и в чём её философия?»
- «`getBy`, `queryBy`, `findBy` — в чём разница?»
- «`fireEvent` или `userEvent`?»
- «Как тестировать асинхронный код и запросы к API?»
- «Как тестировать кастомные хуки и компоненты с контекстом?»
- «Что тестировать, а что нет? Нужны ли snapshot-тесты?»
- «Чем unit/integration тесты отличаются от E2E?»

## Установка и конфигурация (Vitest)

Минимальный стенд (проверен: `vitest 5.1.0`, `@testing-library/react`, `jsdom`):

```js
// vitest.config.js
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: { environment: "jsdom", setupFiles: ["./setup.js"] },
});
```

```js
// setup.js
import "@testing-library/jest-dom/vitest";      // matchers: toBeInTheDocument, toHaveTextContent…
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
afterEach(() => cleanup());                      // размонтировать компоненты после каждого теста
```

В Jest конфигурация иная (`testEnvironment: "jsdom"`, трансформер, например `babel-jest` или `@swc/jest`), API тестов схож (`jest.fn` вместо `vi.fn`).

## Базовый тест

```jsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

it("увеличивает значение по клику и вызывает onChange", async () => {
  const onChange = vi.fn();
  const user = userEvent.setup();
  render(<Counter initial={1} onChange={onChange} />);

  expect(screen.getByText("Счётчик: 1")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Увеличить" }));

  expect(screen.getByText("Счётчик: 2")).toBeInTheDocument();
  expect(onChange).toHaveBeenCalledWith(2);
});
```

Проверено запуском (тест проходит). Структура: **arrange** (render) → **act** (действие пользователя) → **assert** (результат в DOM).

## Запросы: чем искать

Приоритет (по документации Testing Library) — от «как видит пользователь» к «технически»:

1. `getByRole("button", { name: "Войти" })` — роль и доступное имя (лучший выбор, заодно проверяет доступность).
2. `getByLabelText("Email")` — поля форм.
3. `getByPlaceholderText`, `getByText`, `getByDisplayValue`.
4. `getByAltText`, `getByTitle`.
5. `getByTestId("…")` — последнее средство (когда нет семантики).

Три семейства по поведению:

| Вариант | Не найдено | Асинхронный | Для чего |
|---|---|---|---|
| `getBy…` | **бросает** ошибку | нет | элемент должен быть сейчас |
| `queryBy…` | возвращает `null` | нет | проверка **отсутствия** (`expect(queryBy…).not.toBeInTheDocument()`) |
| `findBy…` | отклоняет Promise по таймауту | **да** | элемент появится позже |

Проверено: `getByText("нет такого")` бросает, `queryByText` возвращает `null`.

## userEvent и fireEvent

- **`fireEvent`** — одно синтетическое событие (`change`, `click`).
- **`userEvent`** — имитирует реальное поведение: `type` вызывает `keydown`, `input`, `keyup` для каждого символа, `click` — наведение, фокус, `mousedown`/`mouseup`/`click`. Предпочтителен. Вызовы **асинхронные** (`await user.click(...)`), `userEvent.setup()` вызывают до `render`.

## Формы

```jsx
it("показывает ошибку при неверном email и не отправляет форму", async () => {
  const onSubmit = vi.fn();
  const user = userEvent.setup();
  render(<LoginForm onSubmit={onSubmit} />);

  await user.type(screen.getByLabelText("Email"), "bad");
  await user.click(screen.getByRole("button", { name: "Войти" }));

  expect(screen.getByRole("alert")).toHaveTextContent("Некорректный email");
  expect(onSubmit).not.toHaveBeenCalled();
});
```

Проверено запуском (и вариант с валидным email: `onSubmit` вызван с `{ email: "a@b.co" }`, `alert` отсутствует).

## Асинхронный код и сеть

```jsx
it("показывает загрузку, затем имя", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ name: "Ann" }) }));
  render(<User id={1} />);

  expect(screen.getByText("Загрузка…")).toBeInTheDocument();
  expect(await screen.findByRole("heading", { name: "Ann" })).toBeInTheDocument();
});
```

Проверено (и сценарий ошибки: `ok: false` → `alert` «Ошибка загрузки»). `findBy…` повторяет поиск, пока элемент не появится (по умолчанию до 1 с); `waitFor(() => expect(...))` — для сложных условий. Не используйте произвольные `setTimeout`/`sleep` в тестах.

**Мок сети:**

- `vi.stubGlobal("fetch", …)` / `jest.spyOn(global, "fetch")` — просто, но тест знает о способе запроса.
- **MSW (Mock Service Worker)** — перехватывает HTTP-запросы на уровне сети: код компонента остаётся реальным, тест описывает «сервер» (обработчики `http.get("/api/users/:id", …)`). Подходит для интеграционных тестов с TanStack Query и общими моками в разработке.
- Не забывайте сбрасывать моки между тестами (`vi.unstubAllGlobals()`, `afterEach(() => vi.restoreAllMocks())`).

**Мок модулей:** `vi.mock("./greet.js", () => ({ greet: () => "Mocked" }))` подменяет зависимость на время теста (проверено: компонент вывел `Mocked`). Мокайте границы системы (сеть, время, браузерные API), а не внутренности вашего кода.

## Таймеры

Debounce и таймеры тестируют с fake timers. Проверенный рецепт для `userEvent` + Vitest:

```jsx
it("debounce: onSearch вызывается один раз после паузы", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  const onSearch = vi.fn();
  render(<SearchBox onSearch={onSearch} />);

  await user.type(screen.getByLabelText("search"), "react");
  expect(onSearch).not.toHaveBeenCalled();

  await act(async () => { vi.advanceTimersByTime(300); });
  expect(onSearch).toHaveBeenCalledTimes(1);
  expect(onSearch).toHaveBeenCalledWith("react");
  vi.useRealTimers();
});
```

Подводный камень (проверено): с `vi.useFakeTimers()` без `shouldAdvanceTime` вызов `user.type(...)` в этой конфигурации **завис** до таймаута теста (5 с). Решение — как выше (`shouldAdvanceTime: true` + `advanceTimers`), либо отправлять изменения через `fireEvent.change`.

## Хуки и контекст

```jsx
import { renderHook, act } from "@testing-library/react";

it("тестирует кастомный хук", () => {
  const { result } = renderHook(() => useCounter(5));
  expect(result.current.count).toBe(5);
  act(() => result.current.inc());
  expect(result.current.count).toBe(6);
});

// хук с props
const { result, rerender } = renderHook(({ v }) => useDebounce(v, 100), { initialProps: { v: "a" } });
rerender({ v: "b" });

// компонент или хук внутри провайдера
const wrapper = ({ children }) => <ThemeCtx.Provider value="dark">{children}</ThemeCtx.Provider>;
render(<ThemeLabel />, { wrapper });
```

Проверено запуском: `renderHook` для счётчика и debounce (с fake timers), провайдер контекста через `rerender`. `act` оборачивает действия, меняющие состояние вне событий пользователя; библиотека оборачивает `render`, `userEvent` и `findBy` сама. Предупреждение «not wrapped in act» означает, что состояние изменилось вне ожидаемого окна: обычно нужно дождаться результата (`findBy`/`waitFor`).

Если провайдеров несколько, создают `renderWithProviders` — функцию-обёртку с общими провайдерами (Router, QueryClient, Theme). Для `QueryClient` в тестах создавайте **новый клиент на каждый тест** и отключайте повторные попытки.

## Что тестировать, а что нет

**Тестируйте поведение:** что видит пользователь и что происходит после действий (текст, доступные роли, вызовы колбэков, навигацию, запросы).

**Не тестируйте детали реализации:** значения `state`, названия внутренних методов, количество рендеров, структуру DOM (классы, вложенность). Такие тесты ломаются при рефакторинге, не находя багов.

**Snapshot-тесты** (`toMatchSnapshot`) подходят точечно (небольшой стабильный вывод); большие снимки превращаются в шум, и их «обновляют не глядя».

**Покрытие** — индикатор, а не цель: важно покрывать критичные сценарии и ветки, а не гнаться за процентом.

**Пирамида:** много быстрых unit/интеграционных тестов (чистая логика, хуки, компоненты в jsdom), меньше E2E (Playwright/Cypress) для ключевых пользовательских потоков, авторизации, оплаты, навигации, а также для Server Components и Server Actions, которые удобнее проверять в реальном браузере. jsdom — имитация: реальные размеры, раскладка, `IntersectionObserver` и др. приходится мокать или проверять в E2E.

## Частые follow-up вопросы

**Почему `getByRole` лучше `getByTestId`?**
Он проверяет доступность (роль и имя) и приближает тест к поведению пользователя; `data-testid` — запасной вариант.

**Как проверить, что элемента нет?**
`expect(screen.queryByRole("alert")).not.toBeInTheDocument()`; `getBy` в этом случае бросит ошибку.

**Нужно ли оборачивать всё в `act`?**
Обычно нет: RTL делает это для `render`, `userEvent`, `findBy`/`waitFor`. Вручную — для кода, который обновляет состояние снаружи (таймеры, внешние события).

**Как тестировать компонент с React Router или TanStack Query?**
Оборачивать в провайдеры (`MemoryRouter`, `QueryClientProvider` с новым клиентом) через `wrapper`/`renderWithProviders`.

**Что лучше: Jest или Vitest?**
Оба подходят; Vitest быстрее интегрируется с Vite, API почти совместим с Jest. В проектах Next.js часто используют Jest или Vitest, а для Server Components — E2E.

**Как тестировать компоненты с `useEffect`-загрузкой данных?**
Мокать сеть, проверять состояния «загрузка → данные/ошибка» через `findBy`.

## Типичные ошибки

- Тесты деталей реализации (`state`, вызов приватных функций).
- `getByTestId` везде вместо запросов по роли и тексту.
- Забытые `await` перед `userEvent`.
- `setTimeout`/`sleep` вместо `findBy`/`waitFor`.
- Моки, которые не сбрасываются между тестами.
- Общий `QueryClient` между тестами (утечка кэша).
- Большие snapshot-тесты, которые обновляют без проверки.
- Попытка проверить в jsdom то, что требует настоящего браузера (раскладка, CSS).
